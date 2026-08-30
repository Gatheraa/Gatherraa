import { Worker, Job } from 'bullmq';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const videoWorker = new Worker('video-processing', async (job: Job) => {
  const { videoId, filePath } = job.data;
  
  try {
    // 1. Extract metadata
    const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${filePath}`);
    const duration = parseFloat(stdout.trim());

    // 2. Transcode to multi-bitrate HLS adaptive segments
    // (Generates 360p, 480p, 720p, 1080p variant playlists)
    await execAsync(`ffmpeg -i ${filePath} -filter_complex "[0:v]scale=w=640:h=360[v360];[0:v]scale=w=854:h=480[v480];[0:v]scale=w=1280:h=720[v720];[0:v]scale=w=1920:h=1080[v1080]" ...`);

    // 3. Update job status to completed in database
  } catch (error) {
    throw new Error(`Transcoding failed: ${error.message}`);
  }
}, { connection: { host: 'localhost', port: 6379 } });