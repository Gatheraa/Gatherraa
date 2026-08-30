const mockWorkerProcessor = jest.fn();
const mockWorker = { close: jest.fn() };
const mockExec = jest.fn();

jest.mock('bullmq', () => ({
	Worker: jest.fn((_queueName, processor) => {
		mockWorkerProcessor.mockImplementation(processor);
		return mockWorker;
	}),
}));

jest.mock('child_process', () => ({
	exec: mockExec,
}));

import { videoWorker } from '../video.worker';

describe('videoWorker', () => {
	beforeEach(() => {
		mockExec.mockReset();
		mockWorkerProcessor.mockClear();
	});

	it('registers a worker for the video-processing queue', () => {
		expect(videoWorker).toBe(mockWorker);
		expect(mockWorkerProcessor).toHaveBeenCalledTimes(0);
	});

	it('extracts metadata and transcodes a video', async () => {
		mockExec.mockImplementation((_command, callback) => {
			callback(null, { stdout: '42.5\n', stderr: '' });
		});

		await mockWorkerProcessor({
			data: { videoId: 'video-1', filePath: '/tmp/input.mp4' },
		});

		expect(mockExec).toHaveBeenCalledTimes(2);
		expect(mockExec.mock.calls[0][0]).toContain('ffprobe');
		expect(mockExec.mock.calls[0][0]).toContain('/tmp/input.mp4');
		expect(mockExec.mock.calls[1][0]).toContain('ffmpeg');
	});

	it('wraps transcoding failures with a useful error', async () => {
		mockExec.mockImplementationOnce((_command, callback) => {
			callback(null, { stdout: '42.5\n', stderr: '' });
		});
		mockExec.mockImplementationOnce((_command, callback) => {
			callback(new Error('ffmpeg unavailable'));
		});

		await expect(
			mockWorkerProcessor({
				data: { videoId: 'video-1', filePath: '/tmp/input.mp4' },
			}),
		).rejects.toThrow('Transcoding failed: ffmpeg unavailable');
	});
});
