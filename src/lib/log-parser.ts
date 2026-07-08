// Parses real, uploaded log files into a normalized shape ready to insert
// into `scenario_logs`. Supports the formats a trainer can realistically
// export from a SOC/EDR/SIEM without needing a binary EVTX parser:
//   - CSV (header row required)
//   - JSON (array of objects)
//   - Windows Event Log XML export (Event Viewer "Save All Events As... .xml")
//
// This is intentionally dependency-free so it runs in the browser with no
// extra bundle weight.

export type ParsedLogLine = {
  seq: number;
  event_time: string | null;
  event_id: string | null;
  source: string | null;
  message: string;
  raw: Record<string, unknown>;
};

export function parseLogFile(filename: string, text: string): ParsedLogLine[] {
  const ext = filename.split(".").pop()?.toLowerCase();

  if (ext === "json") return parseJson(text);
  if (ext === "xml" || ext === "evtx.xml") return parseWindowsEventXml(text);
  // default to CSV for .csv, .log, .txt or unrecognized extensions
  return parseCsv(text);
}

function parseJson(text: string): ParsedLogLine[] {
  const data = JSON.parse(text);
  const rows: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.events)
      ? data.events
      : [data];

  return rows.map((row, i) => {
    const r = row as Record<string, unknown>;
    return {
      seq: i + 1,
      event_time: firstString(r, ["timestamp", "time", "TimeCreated", "event_time", "@timestamp"]),
      event_id: firstString(r, ["event_id", "eventId", "EventID", "id"]),
      source: firstString(r, ["source", "Provider", "channel", "Channel", "log_source"]),
      message: firstString(r, ["message", "Message", "msg", "description"]) ?? JSON.stringify(r),
      raw: r,
    };
  });
}

function parseCsv(text: string): ParsedLogLine[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const rows: ParsedLogLine[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const record: Record<string, unknown> = {};
    headers.forEach((h, idx) => (record[h] = cells[idx] ?? ""));

    rows.push({
      seq: i,
      event_time: firstString(record, ["timestamp", "time", "TimeCreated", "event_time", "date"]),
      event_id: firstString(record, ["event_id", "eventId", "EventID", "id"]),
      source: firstString(record, ["source", "Provider", "channel", "Channel", "log_source"]),
      message: firstString(record, ["message", "Message", "msg", "description"]) ?? cells.join(" "),
      raw: record,
    });
  }
  return rows;
}

// Minimal RFC4180-ish CSV splitter (handles quoted fields with commas).
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

// Windows Event Viewer XML export: a <Events> root with repeated <Event> nodes
// following the standard Windows Event Schema.
function parseWindowsEventXml(text: string): ParsedLogLine[] {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) throw new Error("Invalid XML file");

  const events = Array.from(doc.getElementsByTagName("Event"));
  return events.map((ev, i) => {
    const get = (tag: string) => ev.getElementsByTagName(tag)[0]?.textContent?.trim() ?? null;
    const eventId = get("EventID");
    const provider =
      ev.getElementsByTagName("Provider")[0]?.getAttribute("Name") ?? get("Provider");
    const timeCreated =
      ev.getElementsByTagName("TimeCreated")[0]?.getAttribute("SystemTime") ?? get("TimeCreated");

    // Pull EventData/Data name=value pairs into a message string + raw object
    const dataNodes = Array.from(ev.getElementsByTagName("Data"));
    const raw: Record<string, unknown> = {};
    const parts: string[] = [];
    dataNodes.forEach((d) => {
      const name = d.getAttribute("Name") ?? `Data${parts.length}`;
      const value = d.textContent ?? "";
      raw[name] = value;
      parts.push(`${name}=${value}`);
    });

    const rendered = get("RenderingInfo") || get("Message");

    return {
      seq: i + 1,
      event_time: timeCreated,
      event_id: eventId,
      source: provider,
      message:
        rendered ||
        parts.join("; ") ||
        `Event ${eventId ?? "unknown"} from ${provider ?? "unknown source"}`,
      raw,
    };
  });
}

function firstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = record[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
  }
  return null;
}
