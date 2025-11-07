import { RealtimeAgent, RealtimeSession } from '@openai/agents-realtime';
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


interface RealtimeHistoryItem {
  itemId: string;
  status: string;
  content?: Array<{
    type: string;
    transcript: string;
  }>;
}


const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const uploadScreen = document.getElementById("uploadScreen") as HTMLDivElement;
const mainApp = document.getElementById("mainApp") as HTMLDivElement;

const chatBox = document.getElementById("chat-box")!;
const input = document.getElementById('messageInput') as HTMLInputElement | null;
const sendBtn = document.getElementById('sendBtn') as HTMLButtonElement | null;

let session: RealtimeSession | null = null; // top-level, accessible everywhere



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
      // console.log("✅ Filtered JSON stored:", menuData);


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


function appendMessage(text: string, sender: "user" | "bot") {
  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  msg.textContent = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight; // auto-scroll
}


async function getEphemeralKey() {
  console.log("Fetching /api/session...");
  try {
    const res = await fetch("/api/session");
    console.log("Got response:", res.status);
    console.log(res)

    const data = await res.json();
    return data.value;

  } catch (err) {
    console.error("getEphemeralKey failed:", err);
    throw err;
  }
}


async function initAgent(menuData: string) {
  try {
    // 1. Fetch ephemeral key
    const ephemeralKey = await getEphemeralKey();
  

    // 2. Create agent
    const agent = new RealtimeAgent({
      name: "Assistant",
      instructions: `You are a helpful waiter. Use the following menu data to answer questions:\n${menuData}. All prices are in euro. Do not answer any queries that is not related to the menu and only answer in English.`,
    });


    // 3. Connect
    session = new RealtimeSession(agent); // assign to global variable
    await session.connect({ apiKey: ephemeralKey });


    // look for new history every 1 second
    let lastPrintedId: string | null = null;

    setInterval(() => {
      if (!session?.history?.length) return;

      const last = session.history.at(-1) as RealtimeHistoryItem | undefined;
      if (!last) return;

      if (last.status === "completed" && last.itemId !== lastPrintedId) {
        const content = last.content?.[0];
        if (content?.type === "output_audio") {
          appendMessage(content.transcript, "bot");
          lastPrintedId = last.itemId;
        }
      }
    }, 1000);


    // ✅ Hide upload screen
    uploadScreen.style.display = "none";

    // ✅ Show main app screen
    mainApp.style.display = "block";

    console.log("✅ Realtime session started with menu data");
  } catch (err) {
    console.error("❌ Failed to init agent:", err);
    alert("Could not start Realtime session. Check console for details.");
  }
}


// Send text input
function sendMessage(): void {
  if (!input) return;
  const text = input.value.trim();
  if (!text || !session) return;

  appendMessage(text, "user");
  session.sendMessage(text); // send to Realtime session
  input.value = '';
}


// wire up events (optional chaining so no runtime error if button missing)
sendBtn?.addEventListener('click', sendMessage);
input?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});