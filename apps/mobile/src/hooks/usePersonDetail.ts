import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getUserId } from '../lib/auth-store';
import type { DbPersonMobile, DbRelationshipMobile } from '../lib/api';

export interface RelScore {
  overall: number;
  strength: number;
  reciprocity: number;
  trust: number;
}

function computeScore(rel: DbRelationshipMobile): RelScore {
  return {
    overall:    Math.round(rel.strength * 0.4 + rel.reciprocity * 0.3 + rel.trust_score * 100 * 0.3),
    strength:   rel.strength,
    reciprocity: rel.reciprocity,
    trust:      Math.round(rel.trust_score * 100),
  };
}

export function usePersonDetail(personId: string) {
  const [person,       setPerson]       = useState<DbPersonMobile | null>(null);
  const [relationship, setRelationship] = useState<DbRelationshipMobile | null>(null);
  const [score,        setScore]        = useState<RelScore | null>(null);
  const [loading,      setLoading]      = useState(true);

  const fetchAll = useCallback(async () => {
    const userId = getUserId();
    if (!userId) { setLoading(false); return; }

    setLoading(true);

    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from('people').select('*').eq('id', personId).maybeSingle(),
      supabase.from('relationships').select('*')
        .eq('user_id', userId).eq('person_id', personId).maybeSingle(),
    ]);

    const person = (p ?? null) as DbPersonMobile | null;
    const rel    = (r ?? null) as DbRelationshipMobile | null;

    setPerson(person);
    setRelationship(rel);
    setScore(rel ? computeScore(rel) : null);
    setLoading(false);
  }, [personId]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  return { person, relationship, score, loading, refresh: fetchAll };
}
