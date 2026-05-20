import { useState, useEffect, useCallback } from 'react';
import { DailyFocusItem, Goal, Streak, SkillTrack, Countdown } from '../types';
import { todayISO } from '../lib/formatters';

const isElectron = typeof window !== 'undefined' && !!window.pathkeeper;

export function useDailyFocus(refreshKey = 0) {
  const [focus, setFocus] = useState<DailyFocusItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isElectron) return;
    const data = await window.pathkeeper.db.getDailyFocus(todayISO());
    setFocus(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const completeTask = useCallback(async (taskId: string) => {
    if (!isElectron) return;
    await window.pathkeeper.db.completeFocusTask(taskId, todayISO());
    await load();
  }, [load]);

  return { focus, loading, completeTask, reload: load };
}

export function useStreaks(refreshKey = 0) {
  const [streaks, setStreaks] = useState<Streak[]>([]);

  const load = useCallback(async () => {
    if (!isElectron) return;
    const data = await window.pathkeeper.db.getStreaks();
    setStreaks(data);
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  return streaks;
}

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    if (!isElectron) return;
    window.pathkeeper.db.getGoals().then(setGoals);
  }, []);

  return goals;
}

export function useSkillTracks(refreshKey = 0) {
  const [tracks, setTracks] = useState<SkillTrack[]>([]);

  const load = useCallback(async () => {
    if (!isElectron) return;
    const data = await window.pathkeeper.db.getSkillTracks();
    setTracks(data);
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  return tracks;
}

export function useCountdowns(refreshKey = 0) {
  const [countdowns, setCountdowns] = useState<Countdown[]>([]);

  const load = useCallback(async () => {
    if (!isElectron) return;
    const data = await window.pathkeeper.db.getCountdowns();
    setCountdowns(data);
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  return countdowns;
}

export function useSetting(key: string) {
  const [value, setValue] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isElectron) { setLoaded(true); return; }
    window.pathkeeper.db.getSetting(key).then(v => {
      setValue(v);
      setLoaded(true);
    });
  }, [key]);

  const set = useCallback(async (newValue: string) => {
    if (!isElectron) return;
    await window.pathkeeper.db.setSetting(key, newValue);
    setValue(newValue);
  }, [key]);

  return { value, loaded, set };
}
