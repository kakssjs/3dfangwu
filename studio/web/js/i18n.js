// The interface's own text in Chinese and English (D10): [简体中文, English]. The records come from
// the API as they are; the API's error messages are in English, so each error has text here (9.1).

const KEY = 'ir.lang';

function stored() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

const browserLanguage = typeof navigator === 'undefined' ? 'zh-CN' : (navigator.language ?? 'zh-CN');
let current = stored() ?? (browserLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en');
if (current !== 'zh-CN' && current !== 'en') current = 'zh-CN';

export const lang = () => current;
export function setLang(value) {
  current = value;
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* kept for this page only */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = value;
}
if (typeof document !== 'undefined') document.documentElement.lang = current;

const D = {
  // general
  loading: ['加载中…', 'Loading…'],
  back: ['← 返回', '← Back'],
  add: ['＋ 添加', '+ Add'],
  remove: ['删除', 'Remove'],
  any: ['不限', 'Any'],
  verified: ['已核验', 'Verified'],
  expired: ['已过期', 'Expired'],
  'days.left': ['还剩 {n} 天', '{n} days left'],
  'hours.left': ['还剩约 {n} 小时', 'about {n} hours left'],
  'per.m2': ['/ m²', 'per m²'],
  'err.offline': ['网络不通，请稍后再试。', 'You seem to be offline. Please try again.'],
  'err.400': ['填写的内容有误，请检查后再提交', 'Something you entered needs fixing'],
  'err.401': ['请先登录', 'Please sign in first'],
  'err.403': ['这个账号没有权限做这件事', 'This account is not allowed to do that'],
  'err.404': ['找不到这个内容，或它不属于你', 'Not found, or it is not yours'],
  'err.409': ['现在不能这样操作', 'That cannot be done right now'],
  'err.429': ['操作太频繁，请稍等一分钟', 'Too many tries: wait a minute'],
  'err.500': ['服务出了点问题，请稍后再试', 'Something went wrong on our side. Please try again'],

  // enumerations
  'type.new-home': ['新房（毛坯）', 'New home (bare shell)'],
  'type.old-home': ['旧房翻新', 'Old-home renovation'],
  'type.partial': ['局部改造', 'Partial renovation'],
  'style.modern-minimalist': ['现代简约', 'Modern minimalist'],
  'style.cream': ['奶油风', 'Cream'],
  'style.natural-wood': ['原木风', 'Natural wood'],
  'style.new-chinese': ['新中式', 'New Chinese'],
  'style.nordic': ['北欧', 'Nordic'],
  'style.modern-luxury': ['轻奢', 'Modern luxury'],
  'style.industrial': ['工业风', 'Industrial'],
  'style.wabi-sabi': ['侘寂风', 'Wabi-sabi'],
  'kind.company': ['装修公司', 'Company'],
  'kind.team': ['施工队', 'Work team'],
  'status.open': ['进行中', 'Open'],
  'status.awarded': ['已选定团队', 'Team picked'],
  'status.closed': ['已关闭', 'Closed'],
  'status.invited': ['已邀请，等待回复', 'Invited'],
  'status.declined': ['已谢绝', 'Declined'],
  'status.quoted': ['已报价', 'Quoted'],
  'status.selected': ['已中选', 'Selected'],
  'status.not-selected': ['未选中', 'Not selected'],
  'status.expired': ['已过期', 'Expired'],
  'status.pending': ['待审核', 'Pending review'],
  'status.verified': ['已核验', 'Verified'],
  'status.rejected': ['未通过', 'Rejected'],
  'status.suspended': ['已暂停', 'Suspended'],
  'status.todo': ['待办', 'To do'],
  'status.doing': ['进行中', 'Running'],
  'status.done': ['已完成', 'Done'],
  'status.failed': ['已退回', 'Sent back'],
  'status.escalated': ['需要你处理', 'Needs you'],
  'status.strong': ['非常匹配', 'Strong fit'],
  'status.good': ['比较匹配', 'Good fit'],
  'status.possible': ['可以考虑', 'Possible fit'],
  'factor.budget': ['预算', 'Budget'],
  'factor.style': ['风格', 'Style'],
  'factor.experience': ['经验', 'Experience'],
  'factor.local': ['本地案例', 'Local work'],
  'result.good': ['符合', 'Fits'],
  'result.partial': ['部分符合', 'Partly fits'],
  'result.none': ['不符合', 'Does not fit'],
  'result.unknown': ['未说明', 'Not stated'],
  'role.homeowner': ['我是业主，要装修', 'I am a homeowner renovating'],
  'role.contractor': ['我是施工方，接工程', 'I am a contractor taking work'],

  // home
  'home.title': ['AI 装修设计与施工团队匹配', 'AI renovation design and contractor matching'],
  'home.lead': ['把你的需求交给 AI 助手整理，我们为你匹配合适的已核验施工团队，让你在同一份工程范围上比较密封报价。', 'Tell our AI assistant what you need. We match you with verified teams that fit, and you compare sealed quotes on the same scope.'],
  'home.cta.homeowner': ['我要装修', 'I am renovating'],
  'home.cta.contractor': ['施工方入驻', 'Join as a contractor'],
  'home.s1.title': ['1 · 说出需求', '1 · Share your needs'],
  'home.s1.body': ['填写房屋、预算和风格偏好，保存为一个项目。项目只有你自己能看到。', 'Describe the home, budget and style, and save it as a project. Only you can see it.'],
  'home.s2.title': ['2 · 看匹配结果', '2 · See your matches'],
  'home.s2.body': ['按地区、装修类型、预算、风格和经验，列出已核验的团队和理由；你最多同时邀请 3 家。', 'Verified teams are listed by area, type, budget, style and experience, with reasons. Invite up to 3 at a time.'],
  'home.s3.title': ['3 · 比较报价并选定', '3 · Compare quotes and pick'],
  'home.s3.body': ['每家团队在 7 天内给出一份密封报价。你选定后，双方才交换联系方式。', 'Each team gives one sealed quote within 7 days. Contacts are shared only after you pick.'],
  'home.nobid.title': ['为什么不公开招标？', 'Why no open bidding?'],
  'home.nobid.body': ['公开招标容易变成比谁价格低，引发低价抢单、事后增项和施工方之间的恶性竞争。我们改为匹配加邀请：团队看不到彼此，也看不到别人的报价。', 'Open bidding turns into a race to the lowest price: low-balling, extra charges later, and contractors undercutting each other. We match and invite instead: teams never see each other or each other’s quotes.'],

  // register / sign in
  'reg.title': ['注册', 'Register'],
  'reg.role': ['你是', 'You are'],
  'reg.phone': ['手机号', 'Mobile number'],
  'reg.phone.hint': ['中国大陆手机号。目前暂不验证短信验证码。', 'A mainland China mobile number. It is not verified by text message yet.'],
  'reg.name': ['姓名或称呼', 'Name'],
  'reg.password': ['密码', 'Password'],
  'reg.password.hint': ['至少 8 位', 'At least 8 characters'],
  'reg.accept': ['我已阅读并同意上述隐私声明与条款', 'I have read and accept the privacy notice and terms above'],
  'reg.submit': ['注册并登录', 'Register and sign in'],
  'reg.have': ['已有账号？登录', 'Have an account? Sign in'],
  'legal.draft': ['以下文本为草稿，尚待审核确认。', 'These texts are drafts and still to be approved.'],
  'login.title': ['登录', 'Sign in'],
  'login.submit': ['登录', 'Sign in'],
  'login.new': ['没有账号？注册', 'No account? Register'],

  // projects (homeowner)
  'proj.mine': ['我的项目', 'My projects'],
  'proj.new': ['新建项目', 'New project'],
  'proj.empty': ['还没有项目。先写下你的装修需求吧。', 'No projects yet. Start by writing down what you need.'],
  'proj.counts': ['进行中的邀请 {live} 个 · 已收到报价 {quotes} 份', '{live} open invitations · {quotes} quotes received'],
  'proj.privacy': ['项目只有你能看到。你邀请某个团队后，该团队只会在邀请里看到房屋和预算信息，看不到你的姓名、电话和详细地址。', 'Only you can see a project. A team you invite sees only the home and budget details in its invitation, never your name, phone or exact address.'],
  'proj.save': ['保存项目', 'Save project'],
  'proj.link': ['项目链接：', 'Project link:'],
  'proj.close': ['不选了，关闭项目', 'Close without a pick'],
  'proj.close.confirm': ['关闭后，未答复的邀请都会作废。确定吗？', 'Open invitations will be dropped. Close the project?'],
  'proj.closed.note': ['这个项目已关闭。', 'This project is closed.'],
  'p.title': ['项目名称', 'Project title'],
  'p.district': ['区县', 'District'],
  'p.area': ['面积', 'Floor area'],
  'p.layout': ['户型', 'Layout'],
  'p.type': ['装修类型', 'Renovation type'],
  'p.style': ['风格', 'Style'],
  'p.style.none': ['暂不确定', 'Not sure yet'],
  'p.budget': ['预算', 'Budget'],
  'p.budgetMin': ['预算下限（元）', 'Budget from (CNY)'],
  'p.budgetMax': ['预算上限（元）', 'Budget to (CNY)'],
  'p.start': ['期望开工日期', 'Desired start'],
  'p.desc': ['说明', 'Description'],
  'p.desc.hint': ['不要写电话、微信或邮箱，选定团队后平台会交换联系方式。', 'Do not write a phone, WeChat or email: contacts are shared after you pick.'],

  // matches and invitations (homeowner)
  'match.title': ['为你匹配的团队', 'Teams matched to your project'],
  'match.how': ['按规则匹配并说明理由，不按价格排序，也没有人能买到排位。你最多同时邀请 {max} 家。', 'Matched by rules, with reasons: never sorted by price, and nobody can buy a place. You can invite up to {max} at a time.'],
  'match.fit': ['匹配度', 'Fit'],
  'match.invite': ['邀请报价', 'Invite to quote'],
  'match.none': ['没有更多符合条件的已核验团队（已邀请过的不再重复列出）。', 'No more verified teams fit (teams you already invited are not listed again).'],
  'match.full': ['已有 {max} 个进行中的邀请。等有团队答复或过期后，再邀请其他团队。', 'You already have {max} open invitations. Invite more once a team answers or lapses.'],
  'inv.title': ['邀请与报价', 'Invitations and quotes'],
  'inv.order': ['按收到的先后排列，不按价格排序。', 'In the order received, never sorted by price.'],
  'inv.none': ['还没有邀请任何团队。', 'You have not invited any team yet.'],
  'inv.message': ['给团队的话', 'Message to the team'],
  'inv.message.hint': ['选填。不要写联系方式。', 'Optional. No contact details.'],
  'inv.waiting': ['等待回复', 'Waiting for an answer'],
  'inv.reason': ['原因', 'Reason'],
  'inv.profile': ['团队资料', 'Team profile'],
  'inv.open': ['打开邀请页面', 'Open the invitation page'],
  'pick.button': ['选定这份报价', 'Pick this quote'],
  'pick.confirm': ['选定 {name}（报价 {price}）？其他邀请会作废，且不会告知价格。', 'Pick {name} ({price})? Other invitations will close, with no word on prices.'],
  'pick.done': ['已选定', 'Your pick'],
  'pick.contact.note': ['现在你们可以直接联系了。', 'You can now contact each other directly.'],
  'contact.name': ['姓名', 'Name'],
  'contact.phone': ['电话', 'Phone'],

  // browse
  'browse.title': ['已核验的施工团队', 'Verified contractors'],
  'browse.search': ['搜索', 'Search'],
  'browse.none': ['没有找到。', 'None found.'],
  'browse.open': ['查看资料', 'View profile'],

  // profile fields
  'f.city': ['城市', 'City'],
  'f.kind': ['类型', 'Kind'],
  'f.types': ['承接类型', 'Renovation types'],
  'f.styles': ['擅长风格', 'Styles'],
  'f.price': ['常见价格', 'Usual price'],
  'f.years': ['从业年数', 'Years in business'],
  'f.team': ['团队人数', 'Team size'],
  'f.licence': ['统一社会信用代码', 'Business licence number'],
  'f.quals': ['施工资质', 'Qualifications'],
  'f.past': ['过往项目（{n}）', 'Past projects ({n})'],

  // contractor application
  'app.title': ['入驻申请', 'Your application'],
  'app.new': ['请填写资料并提交，审核通过后才会被匹配和邀请。', 'Fill in your details and submit. You can be matched and invited once verified.'],
  'app.pending': ['资料已提交，等待审核。', 'Submitted: waiting for review.'],
  'app.verified': ['已通过核验，可以收到邀请。', 'Verified: you can receive invitations.'],
  'app.rejected': ['审核未通过，请按备注修改后重新保存。', 'Not approved. Fix what the note says and save again.'],
  'app.suspended': ['账号已暂停，暂时不会被匹配，也不能答复邀请。', 'Suspended: you are not matched and cannot answer invitations.'],
  'app.note': ['审核备注', 'Review note'],
  'app.company': ['公司或团队名称', 'Company or team name'],
  'app.licence.hint': ['18 位。我们会在国家企业信用信息公示系统核对。', '18 characters. We check it on the national enterprise credit system.'],
  'app.districts': ['服务区县', 'Districts served'],
  'app.districts.hint': ['用顿号或逗号隔开', 'Separate with commas'],
  'app.priceMin': ['常见价格下限（元/m²）', 'Usual price from (CNY per m²)'],
  'app.priceMax': ['常见价格上限（元/m²）', 'Usual price to (CNY per m²)'],
  'app.capacity': ['可同时承接项目数', 'Projects at once'],
  'app.capacity.hint': ['也限制同时收到的邀请数', 'Also caps your open invitations'],
  'app.qual.name': ['资质名称', 'Qualification'],
  'app.qual.number': ['证书编号', 'Certificate number'],
  'app.qual.until': ['有效期至', 'Valid until'],
  'app.past': ['过往项目（至少 3 个）', 'Past projects (at least 3)'],
  'app.past.title': ['项目名称', 'Project'],
  'app.past.year': ['年份', 'Year'],
  'app.recheck': ['修改公司名、执照号、资质、城市、从业年数或过往项目，会重新进入审核。', 'Changing the company name, licence, qualifications, city, years or past projects sends you back to review.'],
  'app.save': ['保存申请', 'Save application'],

  // invitations (contractor)
  'inv.mine': ['收到的邀请', 'Your invitations'],
  'inv.mine.empty': ['还没有邀请。通过核验后，匹配的业主会邀请你报价。', 'No invitations yet. Once verified, matched homeowners can invite you to quote.'],
  'inv.answer.in': ['答复期限：', 'Time to answer:'],
  'inv.brief.note': ['这里只显示项目概况。选定你之后，业主的姓名和电话才会显示。', 'This is the project brief only. The homeowner’s name and phone appear only if you are picked.'],
  'inv.won': ['恭喜，业主选定了你的报价。', 'Congratulations: the homeowner picked your quote.'],
  'inv.lost': ['业主已做出决定，这次没有选中。', 'The homeowner has decided; you were not selected this time.'],
  'quote.give': ['给出报价', 'Give your quote'],
  'quote.revise': ['修改报价', 'Revise your quote'],
  'quote.sealed': ['这是密封报价：只有业主能看到，其他团队看不到。你可以在业主选定前修改。', 'A sealed quote: only the homeowner sees it. You can revise it until the homeowner picks.'],
  'quote.total.hint': ['总价（元）。分项不得超过总价。', 'Total in CNY. The parts cannot add up to more than the total.'],
  'quote.nocontact': ['不要写电话、微信或邮箱。', 'No phone, WeChat or email.'],
  'quote.send': ['提交报价', 'Send quote'],
  'quote.save': ['保存修改', 'Save changes'],
  'quote.yours': ['你的报价', 'Your quote'],
  'q.total': ['总价', 'Total'],
  'q.labour': ['人工', 'Labour'],
  'q.materials': ['材料', 'Materials'],
  'q.fee': ['管理费', 'Management fee'],
  'q.days': ['工期（天）', 'Duration (days)'],
  'q.start': ['最早开工', 'Earliest start'],
  'q.main': ['主要材料（品牌型号）', 'Main materials (brand and model)'],
  'q.note': ['说明与建议', 'Note and suggestions'],
  'decline.title': ['不接这个项目', 'Decline this project'],
  'decline.button': ['谢绝邀请', 'Decline'],
  'decline.confirm': ['谢绝后不能撤回。确定吗？', 'Declining cannot be undone. Decline?'],

  // console
  'adm.title': ['管理台', 'Console'],
  'adm.key': ['管理密钥', 'Admin key'],
  'adm.key.hint': ['在 studio/.env.local 的 STUDIO_ADMIN_KEY。只保存在这个标签页。', 'STUDIO_ADMIN_KEY in studio/.env.local. Kept in this tab only.'],
  'adm.enter': ['进入', 'Enter'],
  'adm.badkey': ['密钥不对。', 'That key is not right.'],
  'adm.forget': ['退出管理台', 'Leave the console'],
  'adm.contractors': ['施工方审核', 'Contractors'],
  'adm.tasks': ['任务与签批', 'Tasks and sign-offs'],
  'adm.runner': ['运行器', 'Runner'],
  'adm.status': ['状态', 'Status'],
  'adm.to': ['交给', 'Assigned to'],
  'adm.you': ['你（待签批）', 'You (sign-offs)'],
  'adm.none': ['没有符合的记录。', 'Nothing here.'],
  'adm.account': ['账号', 'Account'],
  'adm.note': ['备注', 'Note'],
  'adm.note.hint': ['施工方会看到这条备注。', 'The contractor sees this note.'],
  'adm.verify': ['核验通过', 'Verify'],
  'adm.reject': ['不通过', 'Reject'],
  'adm.suspend': ['暂停', 'Suspend'],
  'adm.approve': ['批准', 'Approve'],
  'adm.sendback': ['退回', 'Send back'],
  'adm.attempts': ['尝试次数', 'attempts'],
  'adm.tokens': ['令牌数', 'tokens'],
  'adm.result': ['结果', 'Result'],
  'adm.log': ['运行记录', 'Run record'],
  'adm.runner.body': ['立即运行所有到期的任务一次。没有配置 MiMo 密钥时，智能体任务会继续等待。', 'Run every due task once now. Without a MiMo key, agent tasks keep waiting.'],
  'adm.runner.run': ['运行一次', 'Run once'],
  'adm.runner.result': ['已开始 {started}，完成 {done}，升级给你 {escalated}，等待 {waiting}', 'Started {started}, done {done}, escalated {escalated}, waiting {waiting}'],

  // header and footer
  'nav.projects': ['我的项目', 'My projects'],
  'nav.new': ['新建项目', 'New project'],
  'nav.browse': ['施工团队', 'Contractors'],
  'nav.application': ['入驻申请', 'Application'],
  'nav.invitations': ['邀请', 'Invitations'],
  'nav.login': ['登录', 'Sign in'],
  'nav.register': ['注册', 'Register'],
  'nav.signout': ['退出', 'Sign out'],
  'nav.console': ['管理台', 'Console'],
  'nav.lang': ['English', '中文'],
  'footer.note': ['AI 生成内容会标明“AI 生成”。平台不经手你与施工方之间的任何款项。', 'AI-made content is labelled “AI-generated”. We never hold money between you and a contractor.'],
  'notfound.title': ['找不到这个页面', 'Page not found'],
};

export function t(key, vars = {}) {
  const entry = D[key];
  const text = entry ? entry[current === 'en' ? 1 : 0] : key;
  return text.replace(/\{(\w+)\}/g, (_, name) => (vars[name] === undefined ? `{${name}}` : String(vars[name])));
}

export const label = (group, value) => (D[`${group}.${value}`] ? t(`${group}.${value}`) : String(value));

/** For the test that checks every key exists in both languages. */
export const dictionary = D;
