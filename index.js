const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// プロジェクト保存
app.post("/api/project", (req,res)=>{
  const data = req.body;
  const file = path.join(__dirname, "data", `${data.name}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  res.json({ ok: true });
});

// プロジェクト読込
app.get("/api/project/:name", (req,res)=>{
  const file = path.join(__dirname, "data", `${req.params.name}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({error:"not found"});
  res.type("json").send(fs.readFileSync(file));
});

app.listen(3001, ()=>console.log("API running on :3001"));
