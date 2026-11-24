import { describe, expect, it } from 'vitest';
import { kurCek, kurEskiMi, KAYNAKLAR } from './kur';

const yanit = (body: unknown, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
const sabit = () => new Date('2026-11-24T10:00:00Z');

describe('kur kaynakları', () => {
  it('birinci kaynak çalışırsa onu kullanır', async () => {
    const k = await kurCek((() => yanit({ result: 'success', rates: { TRY: 50.621508 } })) as any, 100, sabit);
    expect(k).toEqual({ kur: 50.6215, tarih: '2026-11-24T10:00:00.000Z', kaynak: 'ExchangeRate-API' });
  });
  it('birinci hata verirse yedeğe geçer', async () => {
    const f = ((url: string) => url.includes('er-api') ? Promise.reject(new Error('ağ')) : yanit({ rates: { TRY: 50.59 } })) as any;
    expect((await kurCek(f, 100, sabit))?.kaynak).toBe('Frankfurter');
  });
  it('ilk ikisi bozuk veri dönerse üçüncüye geçer', async () => {
    const f = ((url: string) => url.includes('jsdelivr') ? yanit({ usd: { try: 50.5947 } }) : url.includes('er-api') ? yanit({ result: 'error' }) : yanit({}, false)) as any;
    expect(await kurCek(f, 100, sabit)).toMatchObject({ kaynak: 'currency-api', kur: 50.5947 });
  });
  it('hiçbiri çalışmazsa null (hata fırlatmaz)', async () => {
    expect(await kurCek((() => Promise.reject(new Error('x'))) as any, 100, sabit)).toBeNull();
    expect(await kurCek((() => yanit({ rates: { TRY: -5 } })) as any, 100, sabit)).toBeNull();
  });
  it('3 kaynak tanımlı', () => expect(KAYNAKLAR).toHaveLength(3));
  it('15 dakika kuralı', () => {
    const k = { kur: 50, tarih: '2026-11-24T09:50:00Z', kaynak: 'x' };
    expect(kurEskiMi(k, new Date('2026-11-24T10:00:00Z'))).toBe(false);
    expect(kurEskiMi(k, new Date('2026-11-24T10:05:00Z'))).toBe(true);
    expect(kurEskiMi(null, new Date())).toBe(true);
  });
});
