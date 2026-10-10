/**
 * On-demand topic writing. One job per subject, shared by every screen that asks for it
 * (the peek sheet starts a job, the article page keeps reading the same stream).
 */
import { useSyncExternalStore } from "react";
import { streamTopic, StreamError } from "./api";
import { parseTopicStream, slug, toTopic, type PartialTopic } from "./parse";
import { addGenerated, allTopics, getState, getTopic } from "./store";
import { matchCorpus } from "@/content";
import type { Topic } from "./types";

export type JobStatus = "writing" | "done" | "error";

export interface Job {
  id: string;
  query: string;
  status: JobStatus;
  partial: PartialTopic;
  topic?: Topic;
  error?: string;
  demo?: boolean;
}

const IDLE_MS = 60_000;
const OVERALL_MS = 150_000;

const jobs = new Map<string, Job>();
const listeners = new Map<string, Set<() => void>>();
const controllers = new Map<string, AbortController>();

function emit(id: string) {
  listeners.get(id)?.forEach((l) => l());
}

function update(id: string, patch: Partial<Job>) {
  const prev = jobs.get(id);
  if (!prev) return;
  jobs.set(id, { ...prev, ...patch });
  emit(id);
}

/** Fill `related` for a generated topic from tag overlap and its linked openings. */
function relate(t: Topic): Topic {
  const tags = new Set(t.tags);
  const linked = t.bullets.map((b) => b.linkId).filter((x): x is string => !!x);
  const scored = allTopics()
    .filter((x) => x.id !== t.id && !x.generated)
    .map((x) => ({ id: x.id, s: x.tags.filter((g) => tags.has(g)).length + (x.category === t.category ? 0.5 : 0) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.id);
  const related = [...new Set([...linked, ...scored])].slice(0, 6);
  return { ...t, related };
}

/**
 * Resolve a subject to a topic id. Corpus matches and finished generations return
 * immediately; anything else starts (or joins) a writing job.
 */
export function requestTopic(query: string, context?: string): { id: string; existing: boolean } {
  const q = query.trim();
  const corpus = matchCorpus(q);
  if (corpus) return { id: corpus.id, existing: true };
  const id = slug(q);
  if (getState().generated[id]) return { id, existing: true };
  const job = jobs.get(id);
  if (job && job.status !== "error") return { id, existing: false };

  jobs.set(id, { id, query: q, status: "writing", partial: { bullets: [], tags: [], done: false } });
  emit(id);
  const ctrl = new AbortController();
  controllers.set(id, ctrl);
  let text = "";
  let demo = false;
  // Give up if the writer goes quiet for a minute or the whole thing passes 2.5 minutes.
  let timedOut = false;
  const timeout = () => {
    timedOut = true;
    ctrl.abort();
  };
  let idle = window.setTimeout(timeout, IDLE_MS);
  const overall = window.setTimeout(timeout, OVERALL_MS);
  streamTopic(
    q,
    context,
    {
      onDelta: (d) => {
        window.clearTimeout(idle);
        idle = window.setTimeout(timeout, IDLE_MS);
        text += d;
        update(id, { partial: parseTopicStream(text) });
      },
      onMeta: (m) => {
        if (m.provider === "mock") demo = true;
        if (demo) update(id, { demo });
      },
    },
    ctrl.signal,
  )
    .then(() => {
      // The server confirmed completion, so treat the article as finished even if
      // the model forgot its END line.
      const partial = { ...parseTopicStream(text), done: true };
      const topic = toTopic(partial, id, q);
      if (!topic) {
        update(id, { status: "error", error: "Birdie couldn't finish that one. Try again?" });
        return;
      }
      const finished = relate(topic);
      // Demo placeholders aren't worth keeping across visits.
      if (!demo) addGenerated(finished);
      update(id, { status: "done", partial, topic: finished, demo });
    })
    .catch((e: unknown) => {
      if ((e as Error).name === "AbortError") {
        if (timedOut) update(id, { status: "error", error: "Birdie took too long on that one. Try again?" });
        return;
      }
      update(id, {
        status: "error",
        error: e instanceof StreamError ? e.message : "Something went wrong while writing.",
      });
    })
    .finally(() => {
      window.clearTimeout(idle);
      window.clearTimeout(overall);
      controllers.delete(id);
    });
  return { id, existing: false };
}

export function retryTopic(id: string) {
  const job = jobs.get(id);
  if (!job) return;
  jobs.delete(id);
  requestTopic(job.query);
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function useJob(id: string | null): Job | undefined {
  return useSyncExternalStore(
    (l) => {
      if (!id) return () => {};
      let set = listeners.get(id);
      if (!set) listeners.set(id, (set = new Set()));
      set.add(l);
      return () => set!.delete(l);
    },
    () => (id ? jobs.get(id) : undefined),
    () => (id ? jobs.get(id) : undefined),
  );
}

/** Topic if it is ready (corpus, saved generation, or finished job). */
export function readyTopic(id: string): Topic | undefined {
  return getTopic(id) ?? jobs.get(id)?.topic;
}
