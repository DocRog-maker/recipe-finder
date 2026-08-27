const { PDFNet } = require('@pdftron/pdfnet-node');
const { registerModules } = require('../apryse');

/**
 * OCRs a PDF and returns the recognised text. Requires the Apryse OCR/ICR module
 * to be installed (see server/vendor/apryse/README.md).
 *
 * If `page` is given, only that page's text is returned; otherwise every page.
 * If `rect` is given (a WebViewer-space rectangle, top-left origin, on `page`),
 * only text inside that rectangle is returned — used to OCR just the area a user
 * marked over the ingredients.
 *
 * @param {string} pdfPath - path to the PDF on disk
 * @param {number|null} page - 1-based page number, or null for all pages
 * @param {{x1:number,y1:number,x2:number,y2:number}|null} rect - region on `page`
 * @returns {Promise<string>} the OCR'd text
 */
async function ocrRegion(pdfPath, page, rect) {
  let out = '';

  await PDFNet.runWithCleanup(async () => {
    await registerModules();

    const doc = await PDFNet.PDFDoc.createFromFilePath(pdfPath);
    doc.initSecurityHandler();

    // Add a searchable text layer via OCR (needs the OCR/ICR module).
    const ocrOptions = new PDFNet.OCRModule.OCROptions();
    await PDFNet.OCRModule.processPDF(doc, ocrOptions);

    const pageCount = await doc.getPageCount();
    const targetPage = page && page >= 1 && page <= pageCount ? page : null;

    // Read the OCR'd text back out of a page, optionally clipped to `rect`.
    const readPage = async (pageNum) => {
      const p = await doc.getPage(pageNum);

      let clip;
      if (pageNum === targetPage && rect) {
        // WebViewer rectangles are top-left origin; PDFNet is bottom-left, so
        // flip the y coordinates using the page height.
        const height = await p.getPageHeight();
        clip = await PDFNet.Rect.init(rect.x1, height - rect.y2, rect.x2, height - rect.y1);
      } else {
        clip = await p.getCropBox();
      }

      const extractor = await PDFNet.TextExtractor.create();
      extractor.begin(p, clip);
      return extractor.getAsText();
    };

    if (targetPage) {
      out = await readPage(targetPage);
    } else {
      for (let i = 1; i <= pageCount; i++) {
        out += (await readPage(i)) + '\n';
      }
    }
  }, process.env.APRYSE_LICENSE_KEY);

  return out.trim();
}

module.exports = { ocrRegion };
