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


const uploadBtn = document.getElementById("uploadBtn") as HTMLInputElement;
const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const fileInput2 = document.getElementById("fileInput2") as HTMLInputElement;


const uploadScreen = document.getElementById("uploadScreen") as HTMLDivElement;
const mainApp = document.getElementById("mainApp") as HTMLDivElement;

const chatBox = document.getElementById("chat-box")!;
const input = document.getElementById('messageInput') as HTMLInputElement | null;
const sendBtn = document.getElementById('sendBtn') as HTMLButtonElement | null;

let session: RealtimeSession | null = null; // top-level, accessible everywhere



uploadBtn.addEventListener("click", async () => {
  const menuFile = fileInput.files?.[0];
  if (!menuFile) return alert("No menu file selected!");

  const infoFile = fileInput2.files?.[0]; // optional .txt file

  // Helper: read Excel file -> JSON array
  const readExcelFile = (file: File): Promise<Record<string, any>[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        try {
          const result = e.target?.result;
          if (!result) return reject(new Error("No file result"));

          const data = new Uint8Array(result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
          resolve(jsonData);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  };

  // Helper: read .txt file -> string
  const readTextFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const out = reader.result;
        if (typeof out === "string") resolve(out);
        else if (out instanceof ArrayBuffer) resolve(new TextDecoder().decode(out));
        else resolve("");
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file, "utf-8");
    });


  try {
    // Always read the Excel menu file
    const menuJson = await readExcelFile(menuFile);

    // Filter menu data
    const filteredMenu = menuJson.map((row) => {
      const obj: Record<string, any> = {};
      for (const col of FIXED_COLUMNS) {
        obj[col] = row[col];
      }
      return obj;
    });

    const menuData = JSON.stringify(filteredMenu, null, 2);

    // Optionally read the text file
    let infoData: string | null = null;
    if (infoFile) {
      infoData = await readTextFile(infoFile);
    }  else {
      infoData = ""; 
    }


    // ✅ Call your agent with both
    await initAgent(menuData, infoData);

  } catch (err) {
    console.error("Error processing files:", err);
    alert("Error reading one or more files!");
  }
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
    // console.log(res)

    const data = await res.json();
    return data.value;

  } catch (err) {
    console.error("getEphemeralKey failed:", err);
    throw err;
  }
}


async function initAgent(menuData: string, infoData: string) {
  try {
    // 1. Fetch ephemeral key
    // const ephemeralKey = await getEphemeralKey();
    const ephemeralKey = "ek_6918cdeb8c408191b96f257d07b787ac";

    // 2. Create agent
    const agent = new RealtimeAgent({
      name: "Assistant",
      instructions: `
      ## Role & Context
      You are a helpful waiter. 
      Use the following menu data to answer questions:\n${menuData}. \n
      And additional data: \n${infoData}\n
      All prices are in euro. Do not answer any queries that is not related to the menu
      
      ## Unclear Audio
      Only respond to clear audio or text.
      If audio is unclear/partial/noisy/silent, ask for clarification.
      Continue in the same language as the user if intelligible.

      ## Language
      Starter language: use European Portuguese (PT-PT) as the starter language and accent.
      Language matching: Respond in the same language as the user unless directed otherwise.

      ## Variety
      Maintain a friendly, professional tone appropriate for restaurant service.
      Do not repeat the same sentence twice. Vary your responses so it doesn't sound robotic.
      Keep responses concise but engaging, as if you’re interacting with a real diner.
      `
      ,
    });

    

    // 3. Connect
    session = new RealtimeSession(agent); // assign to global variable
    await session.connect({ apiKey: ephemeralKey});

    session.mute(true);
    
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
    }, 600);


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