import { useState, useCallback, useMemo } from 'react';
import { Speaker, SpeakerFormData } from '../types/speaker';

const MOCK_SPEAKERS: Speaker[] = [
  {
    id: '1',
    name: 'Dr. Amara Osei',
    email: 'amara@techconf.io',
    bio: 'Distributed systems researcher with 12 years at the intersection of academia and industry.',
    company: 'Volta Labs',
    title: 'Principal Engineer',
    topic: 'Consensus Without Compromise',
    status: 'confirmed',
    sessionTime: 'Day 1 · 10:00 AM',
    createdAt: '2024-11-01T09:00:00Z',
  },
  {
    id: '2',
    name: 'Marcus Thibodeau',
    email: 'marcus@aicorp.dev',
    bio: 'Building production LLM pipelines for regulated industries since 2021.',
    company: 'Aether AI',
    title: 'Head of ML Infrastructure',
    topic: 'LLMs in the Wild: Lessons from Scale',
    status: 'confirmed',
    sessionTime: 'Day 1 · 2:00 PM',
    createdAt: '2024-11-03T14:00:00Z',
  },
  {
    id: '3',
    name: 'Priya Nair',
    email: 'priya@designops.co',
    bio: 'Design systems lead, speaker, and author of "Tokens All the Way Down".',
    company: 'Chromatic Systems',
    title: 'Design Systems Lead',
    topic: 'Design Tokens at Enterprise Scale',
    status: 'pending',
    sessionTime: 'Day 2 · 11:00 AM',
    createdAt: '2024-11-10T10:30:00Z',
  },
  {
    id: '4',
    name: 'Jonas Eriksson',
    email: 'jonas@rustlang.community',
    bio: 'Open-source contributor and Rust evangelist. Core team member since 2020.',
    company: 'Ferrous Systems',
    title: 'Staff Engineer',
    topic: 'Memory Safety Without Garbage Collection',
    status: 'pending',
    createdAt: '2024-11-12T08:00:00Z',
  },
  {
    id: '5',
    name: 'Yuki Watanabe',
    email: 'yuki@edgecloud.jp',
    bio: 'Platform engineer focused on edge computing and WebAssembly runtimes.',
    company: 'EdgeCloud',
    title: 'Platform Architect',
    topic: 'WASM at the Edge: Beyond the Browser',
    status: 'cancelled',
    createdAt: '2024-11-05T16:00:00Z',
  },
];

let nextId = 6;

export function useSpeakers() {
  const [speakers, setSpeakers] = useState<Speaker[]>(MOCK_SPEAKERS);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSpeakers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return speakers;
    return speakers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.topic.toLowerCase().includes(q) ||
        s.company.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q)
    );
  }, [speakers, searchQuery]);

  const addSpeaker = useCallback((data: SpeakerFormData) => {
    const speaker: Speaker = {
      ...data,
      id: String(nextId++),
      createdAt: new Date().toISOString(),
    };
    setSpeakers((prev) => [speaker, ...prev]);
    return speaker;
  }, []);

  const updateSpeaker = useCallback((id: string, data: SpeakerFormData) => {
    setSpeakers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...data } : s))
    );
  }, []);

  const deleteSpeaker = useCallback((id: string) => {
    setSpeakers((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return {
    speakers: filteredSpeakers,
    totalCount: speakers.length,
    searchQuery,
    setSearchQuery,
    addSpeaker,
    updateSpeaker,
    deleteSpeaker,
  };
}