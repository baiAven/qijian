"""Import company identities and provenance, never infer verified work schedules.
Usage: python3 scripts/import-github.py SNAPSHOT_DIRECTORY
SNAPSHOT_DIRECTORY contains meta.json and 955.md/black.md/white.md fetched at pinned commits.
"""
import sys,json,re,hashlib,html
from pathlib import Path
root=Path(__file__).resolve().parents[1]
folder=Path(sys.argv[1]);meta=json.loads((folder/'meta.json').read_text());companies={};counts={};skipped=[]
def clean(s):
 s=re.sub(r'\[([^\]]+)\]\([^)]*\)',r'\1',s)
 s=re.sub(r'<[^>]+>','',s)
 return html.unescape(s).strip().strip('*').strip()
for m in meta:
 key=m['key'];lines=(folder/f'{key}.md').read_text().splitlines();active=False;count=0
 for i,line in enumerate(lines,1):
  if key=='955':
   if line.startswith('## 955 的公司名单'):active=True;continue
   if active and line.startswith('## '):active=False
   if not active or not line.startswith('* '):continue
   parts=line[2:].split(' - ',1)
   if len(parts)!=2:raise ValueError(f'Unexpected 955 row {i}')
   name,city=map(clean,parts);date='未提供';schedule=''
  else:
   if line.strip()=='名单列表':active=True;continue
   if not active or not line.startswith('|'):continue
   cells=re.split(r'(?<!\\)\|',line.strip().strip('|'))
   if len(cells)<5:raise ValueError(f'Unexpected table row {key}:{i}')
   city,name,date,schedule=map(clean,cells[:4])
   if name in ['公司名字','公司'] or re.fullmatch(r'[:\- ]+',name):continue
   if not name:raise ValueError(f'Empty name {key}:{i}')
   date=date or '未提供'
  canonical=re.sub(r'\s+','',name).casefold().replace('（','(').replace('）',')')
  cid='gh-'+hashlib.sha256(canonical.encode()).hexdigest()[:20]
  city=city or '地区未提供';regions=[x.strip() for x in re.split(r'[/、,，；;]',city) if x.strip()]
  if cid not in companies:companies[cid]={'id':cid,'name':name,'city':'','industry':'行业待补充','intro':'GitHub 历史名单收录，当前工时与业务资料待补充。','github':[],'_cities':[]}
  c=companies[cid]
  for region in regions:
   if region not in c['_cities']:c['_cities'].append(region)
  # Keep identities, dates, original-list membership and provenance. Do not reproduce narrative allegations.
  source={'repository':m['repo'],'list':key,'kind':'black' if key=='black' else 'red','city':city,'recordDate':date,'updatedAt':m['updated'][:10],'importedAt':'2026-09-08','url':f"https://github.com/{m['repo']}/blob/{m['sha']}/{m['path']}#L{i}",'revision':m['sha'],'scheduleTags':sorted(set(re.findall(r'(?<![0-9])(?:996|995|965|955|985|997|007|10106)(?![0-9])|大小周|单休|双休|两班倒|12小时',schedule)))}
  c['github'].append(source);count+=1
 counts[key]=count
for c in companies.values():c['city']='/'.join(c.pop('_cities'))
result=sorted(companies.values(),key=lambda c:c['name'].casefold())
(root/'data/github-companies.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
summary={'importedAt':'2026-09-08','sourceRows':counts,'totalSourceRows':sum(counts.values()),'uniqueCompanies':len(result),'mergedRows':sum(counts.values())-len(result),'sources':meta,'excluded':'996.ICU 黑名单的取消/争议记录表不作为在榜名单导入；仅导入主名单。'}
(root/'data/github-import-manifest.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(summary,ensure_ascii=False,indent=2))
