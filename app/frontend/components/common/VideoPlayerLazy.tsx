import React, { Suspense, useState } from 'react';
import dynamic from 'next/dynamic';
import VideoPlayerSync from '../video/VideoPlayerSync';

// Dynamically import non-critical UI components
const Captions = dynamic(() => import('./VideoPlayerCaptions'), { ssr: false, loading: () => <div className="player-ui-loading">Loading captions...</div> });
const Stats = dynamic(() => import('./VideoPlayerStats'), { ssr: false, loading: () => <div className="player-ui-loading">Loading stats...</div> });
const Comments = dynamic(() => import('./VideoPlayerComments'), { ssr: false, loading: () => <div className="player-ui-loading">Loading comments...</div> });

export interface VideoPlayerLazyProps {
  videoSrc: string;
  autoPlay?: boolean;
  controls?: boolean;
}

const VideoPlayerLazy: React.FC<VideoPlayerLazyProps> = ({ videoSrc, autoPlay = false, controls = true }) => {
  const [showUI, setShowUI] = useState(false);

  // Animate player UI entrance after mount
  React.useEffect(() => {
    const timeout = setTimeout(() => setShowUI(true), 100);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="video-player-lazy">
      <div
        className={`player-core${showUI ? ' player-core-animate' : ''}`}
        style={{ animation: showUI ? 'player-fade-in 0.7s cubic-bezier(0.18,0.9,0.32,1) both' : undefined }}
      >
        <VideoPlayerSync
          videoId={videoSrc}
          src={videoSrc}
          autoPlay={autoPlay}
          controls={controls}
        />
      </div>
      {showUI && (
        <div className="player-ui">
          <Suspense fallback={<div className="player-ui-loading">Loading player UI...</div>}>
            <Captions videoSrc={videoSrc} />
            <Stats videoSrc={videoSrc} />
            <Comments videoSrc={videoSrc} />
          </Suspense>
        </div>
      )}
      <style jsx>{`
        .video-player-lazy {
          width: 100%;
          max-width: 900px;
          margin: 0 auto 2.5rem auto;
        }
        .player-core {
          opacity: 0;
          transform: translateY(32px);
        }
        .player-core-animate {
          opacity: 1;
          transform: translateY(0);
          transition: opacity 0.7s, transform 0.7s;
        }
        @keyframes player-fade-in {
          0% { opacity: 0; transform: translateY(32px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .player-ui {
          margin-top: 1.5rem;
        }
        .player-ui-loading {
          color: #888;
          text-align: center;
          padding: 1.5rem 0;
        }
      `}</style>
    </div>
  );
};

export default VideoPlayerLazy;
