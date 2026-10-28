const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

const replacements = [
  { regex: /bg-white(?!\s+dark:bg-\[\#1C1C1E\])/g, replacement: "bg-white dark:bg-[#1C1C1E]" },
  { regex: /bg-\[\#F2F2F7\](?!\s+dark:bg-black)/g, replacement: "bg-[#F2F2F7] dark:bg-black" },
  { regex: /text-gray-900(?!\s+dark:text-white)/g, replacement: "text-gray-900 dark:text-white" },
  { regex: /text-gray-800(?!\s+dark:text-gray-100)/g, replacement: "text-gray-800 dark:text-gray-100" },
  { regex: /text-gray-500(?!\s+dark:text-gray-400)/g, replacement: "text-gray-500 dark:text-gray-400" },
  { regex: /text-gray-600(?!\s+dark:text-gray-300)/g, replacement: "text-gray-600 dark:text-gray-300" },
  { regex: /bg-gray-50(?!\s+dark:bg-\[\#2C2C2E\])/g, replacement: "bg-gray-50 dark:bg-[#2C2C2E]" },
  { regex: /bg-gray-100(?!\s+dark:bg-\[\#2C2C2E\])/g, replacement: "bg-gray-100 dark:bg-[#2C2C2E]" },
  { regex: /bg-gray-200(?!\s+dark:bg-gray-700)/g, replacement: "bg-gray-200 dark:bg-gray-700" },
  { regex: /border-gray-100(?!\s+dark:border-\[\#2C2C2E\])/g, replacement: "border-gray-100 dark:border-[#2C2C2E]" },
  { regex: /border-gray-200(?!\s+dark:border-gray-700)/g, replacement: "border-gray-200 dark:border-gray-700" }
];

replacements.forEach(({ regex, replacement }) => {
  content = content.replace(regex, replacement);
});

// Since we already manually edited GenericSubScreen, some might be duplicated. 
// We can deduplicate
content = content.replace(/dark:bg-\[\#1C1C1E\] dark:bg-\[\#1C1C1E\]/g, 'dark:bg-[#1C1C1E]');
content = content.replace(/dark:bg-black dark:bg-black/g, 'dark:bg-black');
content = content.replace(/dark:text-white dark:text-white/g, 'dark:text-white');
content = content.replace(/dark:text-gray-400 dark:text-gray-400/g, 'dark:text-gray-400');
content = content.replace(/dark:bg-\[\#2C2C2E\] dark:bg-\[\#2C2C2E\]/g, 'dark:bg-[#2C2C2E]');
content = content.replace(/dark:bg-gray-700 dark:bg-gray-700/g, 'dark:bg-gray-700');
content = content.replace(/dark:text-gray-600 dark:text-gray-600/g, 'dark:text-gray-600');

fs.writeFileSync('src/App.tsx', content);
console.log('Updated App.tsx');
