import axios from "axios";
import * as cheerio from "cheerio";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
import { ChromaClient } from "chromadb";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); // Use API key from environment variables
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const chromaClient = new ChromaClient({
    path: "http://localhost:8000",
});
chromaClient.heartbeat();

const WEB_COLLECTION = `WEB_SCRAPED_DATA_COLLECTION`;

async function scrapeWebpage(url = "") {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const pageHead = $('head').html();
    const pageBody = $('body').html();
    let externalLinks = new Set();
    let internalLinks = new Set();
    $('a').each((_, el) => {
        const link = $(el).attr('href')
        if (link == '/') return;
        if (link.startsWith('http') || link.startsWith('https')) {
            externalLinks.add(link)
        } else {
            internalLinks.add(link)
        }
    })
    return {
        head: pageHead,
        body: pageBody,
        internalLinks: Array.from(internalLinks),
        externalLinks: Array.from(externalLinks)
    }
}

async function generateVectorEmbeddings({ text }) {
    // Using Gemini API to generate embeddings
    const result = await model.generateContent(text);
    const embedding = result.response.text(); // Assuming the generated response is used as embedding
    return embedding;
}

async function ingest(url = "") {
    console.log(`🚀 Ingesting the url : ${url}`);
    const { head, body, internalLinks, externalLinks } = await scrapeWebpage(url);
    const bodyChunks = chunkText(body, 50);

    for (const chunk of bodyChunks) {
        const bodyEmbedding = await generateVectorEmbeddings({ text: chunk });
        insertIntoDB({ embedding: bodyEmbedding, url, head, body: chunk });
    }

    for (const link of internalLinks) {
        const _url = `${url}${link}`;
        await ingest(_url);
    }
    console.log(`👌 Ingesting success for url : ${url}`);
}

function chunkText(text, size) {
    if (typeof text !== "string" || typeof size !== "number" || size <= 0) return [];

    const words = text.trim().split(/\s+/);
    const chunks = [];

    for (let i = 0; i < words.length; i += size) {
        chunks.push(words.slice(i, i + size).join(" "));
    }

    return chunks;
}

async function insertIntoDB({ embedding, url, body = "", head }) {
    const collection = await chromaClient.getOrCreateCollection({
        name: WEB_COLLECTION
    });
    collection.add({
        ids: [url],
        embeddings: [embedding],
        metadatas: [{ url, body, head }]
    });
}

await ingest("https://kaustubh-dev-five.vercel.app/");
