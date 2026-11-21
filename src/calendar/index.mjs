import { createNoneCalendar } from './none.mjs';
import { createIcsCalendar } from './ics.mjs';
import { createIcloudCalendar } from './icloud.mjs';
import { createFeishuCalendar } from './feishu.mjs';

/** calendar 配置 -> 适配器。所有适配器：listBusy / createEvent / check */
export function createCalendar(cfg = {}) {
  switch (cfg.type || 'none') {
    case 'none': return createNoneCalendar();
    case 'ics':
      if (!cfg.url) throw new Error('calendar.url 未设置');
      return createIcsCalendar({ url: cfg.url });
    case 'icloud':
      if (!cfg.appleId || !cfg.appPassword) throw new Error('icloud 需要 appleId 与 appPassword');
      return createIcloudCalendar(cfg);
    case 'feishu': return createFeishuCalendar({ profile: cfg.profile || null, dryRun: !!cfg.dryRun });
    default: throw new Error(`未知日历类型: ${cfg.type}`);
  }
}
