import fs from "fs";
import { extractText, getDocumentProxy } from "unpdf";
const buf = fs.readFileSync("../SIOP/ORLA CONDOMINIO PRAIA/SIOPI - 103 - A.pdf");
const pdf = await getDocumentProxy(new Uint8Array(buf));
const { totalPages, text } = await extractText(pdf, { mergePages: false });
console.log("paginas:", totalPages);
text.forEach((t, i) => { console.log(`\n===== PAGINA ${i + 1} (${t.length} chars) =====`); console.log(t); });
