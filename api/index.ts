import express, { Request, Response } from "express";
const app = express();

app.get("/", (_req: Request, res: Response) => res.send("Express on Vercel"));

app.listen(3000, () => console.log("Server ready on port 3000."));

export default app;