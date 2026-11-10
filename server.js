const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT) || 4321;
const DATA_FILE_PATH = process.env.CHECKLIST_DATA_FILE || path.join(__dirname, "checklist-data.json");
const INDEX_HTML_PATH = path.join(__dirname, "public", "index.html");
const MAXIMUM_REQUEST_BODY_BYTES = 10_000;
const DEFAULT_LIST_NAME = "Checklist";

function createChecklist(listName) {
  return { id: crypto.randomUUID(), name: listName, items: [] };
}

function loadChecklists() {
  if (!fs.existsSync(DATA_FILE_PATH)) {
    return [createChecklist(DEFAULT_LIST_NAME)];
  }
  try {
    const storedData = JSON.parse(fs.readFileSync(DATA_FILE_PATH, "utf8"));
    // A flat array of items is the single-list format; wrap it in one list.
    if (Array.isArray(storedData)) {
      return [{ ...createChecklist(DEFAULT_LIST_NAME), items: storedData }];
    }
    if (Array.isArray(storedData.lists) && storedData.lists.length > 0) {
      return storedData.lists;
    }
  } catch (parseError) {
    console.error("Could not parse data file, starting with an empty list:", parseError.message);
  }
  return [createChecklist(DEFAULT_LIST_NAME)];
}

function saveChecklists(checklists) {
  fs.writeFileSync(DATA_FILE_PATH, JSON.stringify({ lists: checklists }, null, 2));
}

function readTrimmedText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(payload === undefined ? "" : JSON.stringify(payload));
}

function readJsonRequestBody(request) {
  return new Promise((resolve, reject) => {
    let requestBodyText = "";
    request.on("data", (chunk) => {
      requestBodyText += chunk;
      if (requestBodyText.length > MAXIMUM_REQUEST_BODY_BYTES) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(requestBodyText ? JSON.parse(requestBodyText) : {});
      } catch (parseError) {
        reject(new Error("Invalid JSON"));
      }
    });
    request.on("error", reject);
  });
}

let checklists = loadChecklists();

async function handleRequest(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const requestPath = requestUrl.pathname;
  const listPathMatch = requestPath.match(/^\/api\/lists\/([\w-]+)$/);
  const listItemsPathMatch = requestPath.match(/^\/api\/lists\/([\w-]+)\/items$/);
  const listItemPathMatch = requestPath.match(/^\/api\/lists\/([\w-]+)\/items\/([\w-]+)$/);

  if (request.method === "GET" && requestPath === "/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    fs.createReadStream(INDEX_HTML_PATH).pipe(response);
    return;
  }

  if (requestPath === "/api/lists") {
    if (request.method === "GET") {
      sendJson(response, 200, checklists);
      return;
    }
    if (request.method === "POST") {
      const requestBody = await readJsonRequestBody(request);
      const newChecklist = createChecklist(readTrimmedText(requestBody.name) || "Untitled list");
      checklists.push(newChecklist);
      saveChecklists(checklists);
      sendJson(response, 201, newChecklist);
      return;
    }
  }

  const requestedListId = (listPathMatch || listItemsPathMatch || listItemPathMatch)?.[1];
  if (requestedListId) {
    const matchingList = checklists.find((checklist) => checklist.id === requestedListId);
    if (!matchingList) {
      sendJson(response, 404, { error: "List not found" });
      return;
    }

    if (listPathMatch && request.method === "PATCH") {
      const requestBody = await readJsonRequestBody(request);
      const newListName = readTrimmedText(requestBody.name);
      if (!newListName) {
        sendJson(response, 400, { error: "List name is required" });
        return;
      }
      matchingList.name = newListName;
      saveChecklists(checklists);
      sendJson(response, 200, matchingList);
      return;
    }

    if (listPathMatch && request.method === "DELETE") {
      if (checklists.length === 1) {
        sendJson(response, 400, { error: "Cannot delete the only list" });
        return;
      }
      checklists = checklists.filter((checklist) => checklist.id !== requestedListId);
      saveChecklists(checklists);
      sendJson(response, 204);
      return;
    }

    if (listItemsPathMatch && request.method === "POST") {
      const requestBody = await readJsonRequestBody(request);
      const itemText = readTrimmedText(requestBody.text);
      if (!itemText) {
        sendJson(response, 400, { error: "Item text is required" });
        return;
      }
      const newChecklistItem = { id: crypto.randomUUID(), text: itemText, completed: false };
      matchingList.items.push(newChecklistItem);
      saveChecklists(checklists);
      sendJson(response, 201, newChecklistItem);
      return;
    }

    if (listItemPathMatch) {
      const requestedItemId = listItemPathMatch[2];
      const matchingItem = matchingList.items.find((checklistItem) => checklistItem.id === requestedItemId);
      if (!matchingItem) {
        sendJson(response, 404, { error: "Item not found" });
        return;
      }

      if (request.method === "PATCH") {
        const requestBody = await readJsonRequestBody(request);
        if (typeof requestBody.completed === "boolean") {
          matchingItem.completed = requestBody.completed;
        }
        if (readTrimmedText(requestBody.text)) {
          matchingItem.text = readTrimmedText(requestBody.text);
        }
        saveChecklists(checklists);
        sendJson(response, 200, matchingItem);
        return;
      }

      if (request.method === "DELETE") {
        matchingList.items = matchingList.items.filter((checklistItem) => checklistItem.id !== requestedItemId);
        saveChecklists(checklists);
        sendJson(response, 204);
        return;
      }
    }
  }

  sendJson(response, 404, { error: "Not found" });
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((requestError) => {
    sendJson(response, 400, { error: requestError.message });
  });
});

server.listen(PORT, () => {
  console.log(`Checklist app running at http://localhost:${PORT}`);
});
