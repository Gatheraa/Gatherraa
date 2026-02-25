import React, { useEffect, useRef, useState } from 'react';
import DynamicVideoGrid from '../video/DynamicVideoGrid';

// Section config type
type SectionType = 'trending' | 'forYou' | 'newReleases';

export interface SectionConfig {
  type: SectionType;
  title: string;
  apiEndpoint: string; // e.g. '/api/videos/trending', '/api/videos/for-you?userId={userId}'
}

export interface PersonalizedVideoSectionsProps {
  userId: string;
  sectionsConfig: SectionConfig[];
}

// Simple in-memory cache
const sectionCache: Record<string, any> = {};

const fetchSectionVideos = async (endpoint: string) => {
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error('Failed to fetch section');
  return res.json();
};

const getCacheKey = (userId: string, section: SectionConfig) => `${userId}:${section.type}`;

const AnimatedSection: React.FC<{ title: string; children: React.ReactNode; delay: number }> = ({ title, children, delay }) => (
  <section
    className="personalized-section"
    style={{
      animation: `section-fade-in 0.7s cubic-bezier(0.18,0.9,0.32,1) both`,
      animationDelay: `${delay}ms`,
    }}
  >
    <h2 className="section-title">{title}</h2>
    {children}
    <style jsx>{`
      .personalized-section {
        margin-bottom: 2.5rem;
        opacity: 0;
        transform: translateY(32px);
      }
      .section-title {
        font-size: 1.35rem;
        font-weight: 700;
        margin-bottom: 1.2rem;
      }
      @keyframes section-fade-in {
        0% { opacity: 0; transform: translateY(32px); }
        100% { opacity: 1; transform: translateY(0); }
      }
    `}</style>
  </section>
);

const PersonalizedVideoSections: React.FC<PersonalizedVideoSectionsProps> = ({ userId, sectionsConfig }) => {
  const [sectionData, setSectionData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let isMounted = true;
    const fetchAllSections = async () => {
      for (let i = 0; i < sectionsConfig.length; i++) {
        const section = sectionsConfig[i];
        const cacheKey = getCacheKey(userId, section);
        setLoading((prev) => ({ ...prev, [cacheKey]: true }));
        setError((prev) => ({ ...prev, [cacheKey]: null }));
        if (sectionCache[cacheKey]) {
          setSectionData((prev) => ({ ...prev, [cacheKey]: sectionCache[cacheKey] }));
          setLoading((prev) => ({ ...prev, [cacheKey]: false }));
          continue;
        }
        try {
          const endpoint = section.apiEndpoint.replace('{userId}', encodeURIComponent(userId));
          const data = await fetchSectionVideos(endpoint);
          if (isMounted) {
            sectionCache[cacheKey] = data;
            setSectionData((prev) => ({ ...prev, [cacheKey]: data }));
          }
        } catch (err: any) {
          if (isMounted) setError((prev) => ({ ...prev, [cacheKey]: err.message || 'Failed to load' }));
        } finally {
          if (isMounted) setLoading((prev) => ({ ...prev, [cacheKey]: false }));
        }
      }
    };
    fetchAllSections();
    return () => { isMounted = false; };
  }, [userId, JSON.stringify(sectionsConfig)]);

  return (
    <div className="personalized-video-sections">
      {sectionsConfig.map((section, idx) => {
        const cacheKey = getCacheKey(userId, section);
        const videos = sectionData[cacheKey] || [];
        const isLoading = loading[cacheKey];
        const errMsg = error[cacheKey];
        return (
          <AnimatedSection key={section.type} title={section.title} delay={idx * 180}>
            {isLoading ? (
              <div className="section-loading">Loading...</div>
            ) : errMsg ? (
              <div className="section-error">{errMsg}</div>
            ) : (
              <DynamicVideoGrid
                videos={videos}
                onVideoSelect={() => {}}
                gridConfig={{ animateCards: true }}
                emptyMessage="No videos found."
              />
            )}
          </AnimatedSection>
        );
      })}
      <style jsx>{`
        .personalized-video-sections {
          width: 100%;
          margin: 0 auto;
        }
        .section-loading {
          color: #888;
          padding: 2rem 0;
          text-align: center;
        }
        .section-error {
          color: #e53e3e;
          padding: 2rem 0;
          text-align: center;
        }
      `}</style>
    </div>
  );
};

export default PersonalizedVideoSections;
