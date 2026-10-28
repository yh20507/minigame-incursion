// 리눅스에서 빌드할 때도 안쪽 exe 에 아이콘을 넣는다 (wine 없이)
import * as ResEdit from 'resedit';
import * as PELibrary from 'pe-library';
import fs from 'fs';
import path from 'path';

export default async function afterPack(ctx) {
  if (ctx.electronPlatformName !== 'win32') return;
  const exePath = path.join(ctx.appOutDir, ctx.packager.appInfo.productFilename + '.exe');
  const exe = PELibrary.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
  const res = PELibrary.NtExecutableResource.from(exe);
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(ctx.packager.projectDir, 'build', 'icon.ico')));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const id = groups[0]?.id ?? 1;
  const lang = groups[0]?.lang ?? 1033;
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, id, lang, ico.icons.map((i) => i.data));
  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
}
