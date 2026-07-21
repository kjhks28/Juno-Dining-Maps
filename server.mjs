import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const types = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8" };
http.createServer(async (request,response) => {
  try {
    const path = request.url === "/" ? "index.html" : request.url.slice(1);
    const data = await readFile(join(import.meta.dirname,path));
    response.writeHead(200,{"Content-Type":types[extname(path)] ?? "application/octet-stream"});
    response.end(data);
  } catch (error) {
    console.error("파일 제공에 실패했습니다.",error);
    response.writeHead(404,{"Content-Type":"text/plain; charset=utf-8"});
    response.end("페이지를 찾을 수 없습니다.");
  }
}).listen(5173,"127.0.0.1",() => console.log("http://127.0.0.1:5173"));
