import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";

export async function convertToMp4(inputPath: string, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat("mp4")
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}
