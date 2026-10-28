import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');
const oldAnim = "initial={{ opacity: 0, scale: 0.96, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.04, filter: 'blur(10px)' }} transition={{ duration: 0.4, type: 'spring', bounce: 0 }}";
const newAnim = "initial={{ opacity: 0, scale: 0.92, y: 30, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 0.92, y: -30, filter: 'blur(10px)' }} transition={{ duration: 0.5, type: 'spring', bounce: 0.15 }}";
code = code.split(oldAnim).join(newAnim);
fs.writeFileSync('src/App.tsx', code);
console.log('Done!');
