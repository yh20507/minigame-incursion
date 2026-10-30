/** ★4·★5 고유 스킬 정의. 리더로 둘 때만 발동하고, 실제 처리는 scenes/SkillRuntime 이 한다. */
import type { CharDef } from './types';

export type SkillKind =
  | 'start_boost' // 시작 N초 점수 ×M
  | 'rift_armor' // 피격 시 목숨 대신 시간 −N초
  | 'periodic' // every초마다 dur초 점수 ×M
  | 'encore' // 타임업 뒤 N초 보너스 타임
  | 'slow' // (액티브) dur초 슬로우, 쿨 cd
  | 'dodge' // 피격 chance% 무효
  | 'extra_life' // 목숨 +N
  | 'time_bank' // per점마다 시간 +sec
  | 'last_stand' // 목숨 0 이후 dur초 더 (점수 ×M)
  | 'roulette' // 시작 시 무작위 버프 + 부활 1회
  | 'shield_regen' // every초마다 보호막 +1
  | 'invuln' // (액티브) dur초 무적(+점수 ×M), 쿨 cd
  | 'warp' // 피격 chance% 무효 + 피격마다 시간 +refund
  | 'combo' // 무피격 연속 득점 배율 (step씩, 최대 max)
  | 'late_bloom' // 마지막 N초 점수 ×M
  | 'revive_plus' // 부활 1회 + 부활 후 dur초 무적·점수 ×M
  | 'crit' // 득점 chance% 확률 ×M
  | 'hunt' // 득점할수록 속도↑ 점수↑
  | 'live_start' // 시작 dur초 무적·점수 ×M + 부활 1회
  | 'rhythm' // window초 내 연속 득점 콤보 +step% (최대 max%)
  | 'endure' // 피격 뒤 dur초 무적 + 시간 +refund
  | 'time_stop' // (액티브) dur초 완전 정지, 1회
  | 'rewrite'; // 피격 1회 취소 (N회)

export interface SkillDef {
  id: string;
  kind: SkillKind;
  name: string;
  /** 액티브면 true (Shift / 버튼) */
  active?: boolean;
  p: Record<string, number>;
}

/** 강화 단계(0~3)에 따라 수치 보정 */
export function skillParams(s: SkillDef, b: number) {
  const up = 1 + 0.15 * b;
  const o: Record<string, number> = {};
  for (const [k, v] of Object.entries(s.p)) {
    if (k === 'cd') o[k] = Math.round(v * (1 - 0.08 * b) * 10) / 10;
    else if (k === 'mult' || k === 'factor' || k === 'max' || k === 'per' || k === 'every' || k === 'n' || k === 'last' || k === 'window') o[k] = v;
    else o[k] = Math.round(v * up * 10) / 10;
  }
  if (b >= 3 && (s.kind === 'extra_life' || s.kind === 'rewrite')) o.n = (o.n ?? 1) + 1;
  return o;
}

/** 사람이 읽는 설명 */
export function skillDesc(s: SkillDef, b = 0) {
  const p = skillParams(s, b);
  switch (s.kind) {
    case 'start_boost':
      return `시작 ${p.dur}초 동안 점수 ×${p.mult}`;
    case 'rift_armor':
      return `피격 시 목숨 대신 시간 −${p.time}초 (시간이 0이면 종료)`;
    case 'periodic':
      return `${p.every}초마다 ${p.dur}초 동안 점수 ×${p.mult}`;
    case 'encore':
      return `타임 업 뒤 ${p.dur}초 보너스 타임 (피격 없음)`;
    case 'slow':
      return `[액티브] ${p.dur}초 동안 모든 게 ${Math.round(p.factor * 100)}% 속도 · 쿨 ${p.cd}초`;
    case 'dodge':
      return `피격 ${p.chance}% 확률로 무효`;
    case 'extra_life':
      return `목숨 +${p.n ?? 1}로 시작`;
    case 'time_bank':
      return `${p.per}점마다 시간 +${p.sec}초`;
    case 'last_stand':
      return `쓰러져도 ${p.dur}초 더 버팀 · 그동안 점수 ×${p.mult}`;
    case 'roulette':
      return `시작 시 무작위 버프 1개 + 쓰러지면 1회 부활`;
    case 'shield_regen':
      return `${p.every}초마다 보호막 +1`;
    case 'invuln':
      return `[액티브] ${p.dur}초 무적${p.mult > 1 ? ` · 점수 ×${p.mult}` : ''} · 쿨 ${p.cd}초`;
    case 'warp':
      return `피격 ${p.chance}% 확률로 무효 · 피격마다 시간 +${p.refund}초`;
    case 'combo':
      return `피격 없이 득점할 때마다 배율 +${Math.round(p.step * 100)}% (최대 ×${p.max}) · 맞으면 초기화`;
    case 'late_bloom':
      return `마지막 ${p.last}초 점수 ×${p.mult}`;
    case 'revive_plus':
      return `쓰러지면 1회 부활 · 부활 뒤 ${p.dur}초 무적·점수 ×${p.mult}`;
    case 'crit':
      return `득점 ${p.chance}% 확률로 ×${p.mult}`;
    case 'hunt':
      return `${p.per}점마다 속도 +10% · 점수 +20% (최대 ${p.max}단계) — 고위험 고수익`;
    case 'live_start':
      return `시작 ${p.dur}초 무적·점수 ×${p.mult} + 쓰러지면 1회 부활`;
    case 'rhythm':
      return `${p.window}초 안에 연속 득점하면 콤보당 +${p.step}% (최대 +${p.max}%)`;
    case 'endure':
      return `피격 뒤 ${p.dur}초 무적 · 피격마다 시간 +${p.refund}초`;
    case 'time_stop':
      return `[액티브] ${p.dur}초 동안 시간 정지 · 판마다 1회`;
    case 'rewrite':
      return `피격 ${p.n ?? 1}회 취소 (없던 일로)`;
  }
}

export function charSkill(c: CharDef): SkillDef | null {
  return c.skill ?? null;
}
