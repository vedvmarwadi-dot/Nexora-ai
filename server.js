
import express from "express";
import dotenv from "dotenv";
import { fal } from "@fal-ai/client";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = "wan/v2.6/text-to-video";

app.use(express.json());
app.use(express.static("public"));

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}

const jobs = new Set();

app.post("/generate", async (req, res) => {
  try {
    if (!process.env.FAL_KEY)
      return res.status(503).json({error:"API key not configured"});

    const { prompt, ratio = "9:16", duration = 5 } = req.body;

    if (!prompt || prompt.length > 1500)
      return res.status(400).json({error:"Invalid prompt"});

    if (!["9:16","16:9","1:1"].includes(ratio))
      return res.status(400).json({error:"Invalid ratio"});

    if (![5,10,15].includes(Number(duration)))
      return res.status(400).json({error:"Invalid duration"});

    const job = await fal.queue.submit(MODEL, {
      input: {
        prompt,
        aspect_ratio: ratio,
        duration: String(duration),
        resolution: "720p"
      }
    });

    jobs.add(job.request_id);
    res.json({id:job.request_id});

  } catch(error) {
    res.status(500).json({error:"Generation failed to start"});
  }
});

app.get("/status/:id", async (req,res) => {
  try {
    const id = req.params.id;

    if (!jobs.has(id))
      return res.status(404).json({error:"Job not found"});

    const status = await fal.queue.status(MODEL, {
      requestId:id
    });

    if(status.status === "COMPLETED") {
      const result = await fal.queue.result(MODEL, {
        requestId:id
      });

      jobs.delete(id);
      return res.json({
        status:"done",
        video:result.data.video.url
      });
    }

    if(status.status === "FAILED") {
      jobs.delete(id);
      return res.json({status:"failed"});
    }

    res.json({status:status.status});

  } catch(error) {
    res.status(500).json({error:"Status check failed"});
  }
});

app.listen(PORT,"0.0.0.0",() => {
  console.log("NEXORA AI is running!");
});
