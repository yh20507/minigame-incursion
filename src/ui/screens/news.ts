/** 새 소식 (시즌) 창 */
import { App } from '../../core/app';
import { currentSeason, markNewsSeen } from '../../core/news';
import { ui } from '../app';
import { btn, charImg } from '../components';
import { h, svg } from '../dom';
import { I } from '../icons';

export function showNews(manual: boolean) {
  const s = currentSeason();
  if (!s) return;
  void manual;
  const banners = s.banners
    .map((bid) => App.content.banners.find((b) => b.id === bid))
    .filter((b): b is NonNullable<typeof b> => !!b)
    .slice(0, 4);
  const close = ui.modal({
    cls: 'news-modal',
    wide: true,
    body: h(
      'div',
      { class: 'news' },
      h(
        'div',
        { class: 'news-text' },
        h('div', { class: 'eyebrow' }, 'NEWS'),
        h('h2', null, s.name),
        h('p', { class: 'news-period gold' }, svg(I.calendar), ` ${s.start} ~ ${s.end ?? '종료일 미정'}`),
        h('p', { class: 'news-desc' }, s.desc),
        h('ul', { class: 'news-notes' }, s.notes.map((n) => h('li', null, n))),
        banners.length
          ? h(
              'div',
              { class: 'news-banners' },
              banners.map((b) =>
                btn(b.name.replace(' 균열', ''), () => {
                  close();
                  ui.show('Gacha', { banner: b.id });
                }, { cls: 'sm', color: b.world ? App.content.domainColor(b.world) : undefined, icon: I.rift }),
              ),
            )
          : null,
      ),
      s.highlight && App.content.hasChar(s.highlight) ? h('div', { class: 'news-art' }, charImg(s.highlight, 'best')) : null,
    ),
    buttons: [{ label: '닫기', primary: true }],
    onClose: markNewsSeen,
  });
}
