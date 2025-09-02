import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime';
import * as XLSX from "xlsx";

// Columns you want to keep
const FIXED_COLUMNS = [
  "CategoryTitleEn",
  "SubcategoryTitleEn",
  "ItemNameEn",
  "ItemPrice",
  "Calories",
  "PortionSize",
  "ItemDescriptionEn",
];

const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const uploadScreen = document.getElementById("uploadScreen") as HTMLDivElement;
const mainApp = document.getElementById("mainApp") as HTMLDivElement;

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return alert("No file selected!");

  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Convert sheet to JSON array
      const jsonData: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet);

      // Keep only the fixed columns
      const filteredData = jsonData.map((row) => {
        const obj: Record<string, any> = {};
        for (const col of FIXED_COLUMNS) {
          obj[col] = row[col];
        }
        return obj;
      });

      // Store globally so the agent can access
      const menuData = JSON.stringify(filteredData, null, 2);
      console.log("✅ Filtered JSON stored:", menuData);


    // ✅ Call initAgent safely using a separate async IIFE
    (async () => {
      await initAgent(menuData);
    })();

    } catch (err) {
      console.error("Error processing Excel file:", err);
    }
  };

  reader.readAsArrayBuffer(file);
});

async function initAgent(menuData: string) {
  const agent = new RealtimeAgent({
    name: 'Assistant',
    // Include the menu data in the instructions
    instructions: `You are a helpful assistant. Use the following menu data to answer questions:\n${menuData}. All prices are in euro.`,
  });

  const session = new RealtimeSession(agent);

  await session.connect({
    apiKey: '', // ⚠️ Browser-safe Client key
  });

  // ✅ Hide upload screen
  uploadScreen.style.display = "none";

  // ✅ Show main app screen
  mainApp.style.display = "block";
  
  console.log("✅ Realtime session started with menu data");
}
