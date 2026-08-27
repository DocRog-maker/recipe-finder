const { PDFNet } = require('@pdftron/pdfnet-node');
const { registerModules } = require('../apryse');

/**
 * OCRs a PDF and returns the recognised text. Requires the Apryse OCR/ICR module
 * to be installed (see server/vendor/apryse/README.md).
 *
 * If `rect` is given (a WebViewer-space rectangle, top-left origin, on `page`),
 * OCR is restricted to that rectangle via an include ("text") zone and all of
 * its recognised text is returned. Otherwise, if `page` is given only that page
 * is OCR'd; failing that, the whole document is.
 *
 * @param {string} pdfPath - path to the PDF on disk
 * @param {number|null} page - 1-based page number, or null for all pages
 * @param {{x1:number,y1:number,x2:number,y2:number}|null} rect - region on `page`
 * @returns {Promise<string>} the OCR'd text
 */
async function ocrRegion(pdfPath, page, rect) {
  let out = '';
  console.log(rect)
  await PDFNet.runWithCleanup(async () => {
    await registerModules();

    const doc = await PDFNet.PDFDoc.createFromFilePath(pdfPath);
    doc.initSecurityHandler();

    const pageCount = await doc.getPageCount();
    const targetPage = page && page >= 1 && page <= pageCount ? page : null;

    const ocrOptions = new PDFNet.OCRModule.OCROptions();

    // When a rectangle is given, tell OCR to only look inside it (an include /
    // "text" zone) rather than OCRing the whole page and clipping afterwards.
    let clip = null;
    if (rect && targetPage) {
      // Zones are given in PDF page coordinates (bottom-left origin), so flip the
      // top-left-origin WebViewer rectangle using the page height.
      const p = await doc.getPage(targetPage);
      const height = await p.getPageHeight();
      const zone = { x1: rect.x1, y1: height - rect.y2, x2: rect.x2, y2: height - rect.y1 };

      ocrOptions.setUsePDFPageCoords(true);
      ocrOptions.addTextZonesForPage([zone], targetPage);

      // Read back the OCR'd text clipped to the same region.
      clip = await PDFNet.Rect.init(zone.x1, zone.y1, zone.x2, zone.y2);
    }

    await PDFNet.OCRModule.processPDF(doc, ocrOptions);

    const readPage = async (pageNum, clipRect) => {
      const p = await doc.getPage(pageNum);
      const extractor = await PDFNet.TextExtractor.create();
      extractor.begin(p, clipRect || (await p.getCropBox()));
      return extractor.getAsText();
    };

    if (targetPage) {
      out = await readPage(targetPage)//, clip);
    } else {
      for (let i = 1; i <= pageCount; i++) {
        out += (await readPage(i)) + '\n';
      }
    }

  }, process.env.APRYSE_LICENSE_KEY);

  return out.trim();
}

module.exports = { ocrRegion };
