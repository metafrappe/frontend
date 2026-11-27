import { describe, expect, it } from 'vitest';

import {
  AGENT_MODES,
  approveFlow,
  createFlow,
  FLOW_STEPS,
  MODE_LABELS,
  parseFlowEvent,
  receiveServerEvent,
  setFlowMode,
  STEP_LABELS,
} from './flow';
import type { AgentMode, FlowState } from './flow';

const tool = (key: string, status = 'success') =>
  JSON.stringify({ type: 'tool', key, tool: 'orders.read', title: 'Siparişler okundu', status });
const step = (name: string) => JSON.stringify({ type: 'step', step: name });

function feed(state: FlowState, ...events: string[]): FlowState {
  return events.reduce(receiveServerEvent, state);
}

/** Drives the flow up to the approval step in `act` mode. */
function atApproval(): FlowState {
  return feed(setFlowMode(createFlow(), 'act'), step('plan'), step('preview'), step('approval'));
}

describe('akış adımları ve kipler', () => {
  it('altı adım ve dört kip taslaktaki sırayla tanımlıdır', () => {
    expect(FLOW_STEPS).toEqual(['intent', 'plan', 'preview', 'approval', 'apply', 'undo']);
    expect(FLOW_STEPS.map((s) => STEP_LABELS[s])).toEqual([
      'Niyet',
      'Plan',
      'Önizleme',
      'Onay',
      'Uygulama',
      'Geri alma önerisi',
    ]);
    expect(AGENT_MODES.map((m) => MODE_LABELS[m])).toEqual([
      'Sor',
      'Ara',
      'Taslak hazırla',
      'İşlem yap',
    ]);
  });

  it('akış niyet adımında, "Sor" kipinde ve boş araç listesiyle başlar', () => {
    const flow = createFlow();
    expect(flow.step).toBe('intent');
    expect(flow.mode).toBe('ask');
    expect(flow.tools).toEqual([]);
    expect(flow.approved).toBe(false);
  });
});

describe('araç olayları yalnız sunucudan gelir', () => {
  it('sunucu olayı gelmeden araç olayı listesi boş kalır', () => {
    let flow = setFlowMode(createFlow(), 'act');
    flow = feed(flow, step('plan'), step('preview'));
    flow = feed(flow, JSON.stringify({ type: 'text', delta: 'Merhaba' }));
    expect(flow.tools).toEqual([]);
  });

  it('sunucu olayı gelince araç olayı listeye bir kez eklenir', () => {
    let flow = feed(createFlow(), step('plan'), tool('t1'));
    expect(flow.tools).toHaveLength(1);
    flow = feed(flow, tool('t1'));
    expect(flow.tools).toHaveLength(1);
    flow = feed(flow, tool('t1', 'error'));
    expect(flow.tools).toEqual([
      { key: 't1', tool: 'orders.read', title: 'Siparişler okundu', status: 'error' },
    ]);
  });

  it('izinsiz araç ve bozuk olay listeye girmez', () => {
    const flow = feed(
      createFlow(),
      JSON.stringify({ type: 'tool', key: 'x', tool: 'shell.exec', title: 'x', status: 'success' }),
      '{bozuk',
      JSON.stringify({ type: 'tool', key: 'y' }),
    );
    expect(flow.tools).toEqual([]);
  });

  it('nesne olarak verilen olay kabul edilmez, yalnız sunucu satırı okunur', () => {
    const flow = receiveServerEvent(createFlow(), {
      type: 'tool',
      key: 't1',
      tool: 'orders.read',
      title: 'Uydurma',
      status: 'success',
    } as unknown as string);
    expect(flow.tools).toEqual([]);
  });
});

describe('adımlar yalnız ileri gider', () => {
  it('geri adım olayı yok sayılır', () => {
    const flow = feed(setFlowMode(createFlow(), 'act'), step('preview'), step('plan'));
    expect(flow.step).toBe('preview');
  });

  it('onay gelmeden uygulama adımına geçilmez', () => {
    let flow = atApproval();
    expect(flow.step).toBe('approval');
    flow = feed(flow, step('apply'), JSON.stringify({ type: 'applied' }));
    expect(flow.step).toBe('approval');
    expect(flow.approved).toBe(false);
  });

  it('onaydan sonra sunucu uygulama olayı gönderince uygulama adımına geçer', () => {
    let flow = approveFlow(atApproval());
    expect(flow.approved).toBe(true);
    expect(flow.step).toBe('approval');
    flow = feed(flow, step('apply'));
    expect(flow.step).toBe('apply');
  });

  it('önizleme gelmeden onay adımı açılmaz', () => {
    const flow = feed(setFlowMode(createFlow(), 'act'), step('plan'), step('approval'));
    expect(flow.step).toBe('plan');
  });

  it('onay yalnız onay adımında verilir', () => {
    const early = feed(setFlowMode(createFlow(), 'act'), step('plan'));
    expect(approveFlow(early).approved).toBe(false);
  });

  it('kip yalnız niyet adımında değişir', () => {
    const flow = feed(createFlow(), step('plan'));
    expect(setFlowMode(flow, 'act').mode).toBe('ask');
  });
});

describe('yalnız "İşlem yap" kipi onay adımına geçer', () => {
  it.each<AgentMode>(['ask', 'search', 'draft'])('"%s" kipi onay adımına geçmez', (mode) => {
    let flow = setFlowMode(createFlow(), mode);
    flow = feed(flow, step('plan'), step('preview'), step('approval'));
    expect(flow.step).not.toBe('approval');
    flow = approveFlow(flow);
    flow = feed(flow, step('apply'), JSON.stringify({ type: 'undo', endpoint: '/api/undo/1' }));
    expect(flow.approved).toBe(false);
    expect(['intent', 'plan', 'preview']).toContain(flow.step);
  });
});

describe('geri alma önerisi', () => {
  const applied = () => feed(approveFlow(atApproval()), step('apply'));

  it('arka uç geri alma ucunu bildirmezse geri alma adımı açılmaz', () => {
    const flow = feed(applied(), step('undo'));
    expect(flow.step).toBe('apply');
    expect(flow.undoEndpoint).toBeUndefined();
  });

  it('arka uç geri alma ucunu bildirince geri alma adımı açılır', () => {
    const flow = feed(applied(), JSON.stringify({ type: 'undo', endpoint: '/api/undo/1' }));
    expect(flow.step).toBe('undo');
    expect(flow.undoEndpoint).toBe('/api/undo/1');
  });

  it('uygulamadan önce gelen geri alma ucu yok sayılır', () => {
    const flow = feed(atApproval(), JSON.stringify({ type: 'undo', endpoint: '/api/undo/1' }));
    expect(flow.step).toBe('approval');
    expect(flow.undoEndpoint).toBeUndefined();
  });
});

describe('güven yüzdesi ve iç düşünce taşınmaz', () => {
  it('olaydaki güven yüzdesi ve iç düşünce alanları atılır', () => {
    const raw = JSON.stringify({
      type: 'tool',
      key: 't1',
      tool: 'orders.read',
      title: 'Siparişler okundu',
      status: 'success',
      confidence: 0.92,
      confidencePercent: 92,
      thought: 'kullanıcı muhtemelen...',
      reasoning: 'iç düşünce',
    });
    const event = parseFlowEvent(raw);
    expect(event).toEqual({
      type: 'tool',
      key: 't1',
      tool: 'orders.read',
      title: 'Siparişler okundu',
      status: 'success',
    });
    const flow = receiveServerEvent(createFlow(), raw);
    const text = JSON.stringify(flow);
    expect(text).not.toMatch(/confidence|thought|reasoning|0\.92|muhtemelen/);
  });

  it('düşünce olayı tanınmaz', () => {
    expect(parseFlowEvent(JSON.stringify({ type: 'thought', text: 'gizli' }))).toBeNull();
    expect(parseFlowEvent(JSON.stringify({ type: 'reasoning', text: 'gizli' }))).toBeNull();
  });

  it('adım ve geri alma olaylarındaki fazla alanlar da atılır', () => {
    expect(parseFlowEvent(JSON.stringify({ type: 'step', step: 'plan', confidence: 0.5 }))).toEqual(
      {
        type: 'step',
        step: 'plan',
      },
    );
    expect(
      parseFlowEvent(JSON.stringify({ type: 'undo', endpoint: '/api/undo/1', thought: 'x' })),
    ).toEqual({ type: 'undo', endpoint: '/api/undo/1' });
  });
});
