<template>
  <div class="static-page">
    <h1>服务条款</h1>
    <p class="meta">最后更新：2026-01-21</p>
    <p>为保障您的合法权益并维护平台秩序，请在使用前仔细阅读并同意本条款。继续使用即视为您已阅读、理解并同意受其约束。</p>

    <h2>要点概览</h2>
    <ul>
      <li>账户安全：妥善保管凭据，异常请及时联系我们；</li>
      <li>用户行为：不得发布违法、侵权、骚扰等不当内容；</li>
      <li>知识产权：原创归属作者，含第三方素材须合法授权；</li>
      <li>隐私保护：遵循最小必要原则与用途限制；</li>
      <li>违规处理：情节不同，可能删除内容或限制/终止服务；</li>
      <li>争议解决：优先协商，必要时按适用法及管辖解决。</li>
    </ul>

    <h2>一、条款的接受与更新</h2>
    <ul>
      <li>平台可根据运营需要更新条款；</li>
      <li>更新将通过站内公告/页面提示告知；</li>
      <li>自公布之日起生效。</li>
    </ul>

    <h2>二、账户与安全</h2>
    <ul>
      <li>妥善保管登录凭据，不得出租/共享/转让；</li>
      <li>发现异常请及时联系我们；</li>
      <li>因保管不当产生的风险自行承担。</li>
    </ul>

    <h2>三、用户行为规范</h2>
    <ul>
      <li>禁止违法、侵权、骚扰、欺诈等不当内容；</li>
      <li>禁止刷量、攻击、恶意爬虫、散播病毒等；</li>
      <li>遵守法律法规与社区规则，尊重他人权益。</li>
    </ul>

    <h2>四、内容与知识产权</h2>
    <ul>
      <li>原创内容版权归您所有；</li>
      <li>含第三方素材须合法授权并注明来源；</li>
      <li>为展示/分发/推广之目的，授予平台非独占、可撤销的使用许可；</li>
      <li>侵权投诉渠道见“联系”。</li>
    </ul>

    <h2>五、隐私与数据保护</h2>
    <ul>
      <li>最小必要收集与用途限制；</li>
      <li>用于提供/改进服务与账号安全；</li>
      <li>更多细则见隐私说明。</li>
    </ul>

    <h2>六、未成年人保护</h2>
    <ul>
      <li>建议在监护指导下合理使用；</li>
      <li>不应接触与年龄不符的内容。</li>
    </ul>

    <h2>七、违规处理与申诉</h2>
    <ul>
      <li>视情节删除/屏蔽、限制功能、暂停或终止服务；</li>
      <li>如有异议，可通过“联系”发起申诉。</li>
    </ul>

    <h2>八、服务变更与中断</h2>
    <ul>
      <li>基于运营/安全需要可变更、暂停或终止；</li>
      <li>将尽合理努力进行告知。</li>
    </ul>

    <h2>九、免责声明与责任限制</h2>
    <ul>
      <li>服务按“现状”提供，不保证特定目的适用性；</li>
      <li>不可抗力或第三方原因导致的损失不承担相应责任。</li>
    </ul>

    <h2>十、适用法律与争议解决</h2>
    <ul>
      <li>适用您所在辖区的相关法律（强制性规范优先）；</li>
      <li>优先协商；协商不成，按管辖提出诉讼。</li>
    </ul>

    <h2>十一、联系我们</h2>
    <p>版权投诉、违规举报、商务合作等，请参见“联系”页面获取渠道与模板。</p>

    <p class="muted">提示：以上为示例条款，请根据实际法务要求进行审核与替换。</p>
  </div>
</template>

<script>
export default { name: 'TermsPage' }
</script>

<style scoped>
.static-page { max-width: 960px; margin: 24px auto; padding: 28px 28px 24px; background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 6px 20px rgba(0,0,0,.08); }
h1 { font-size: 30px; line-height: 1.3; margin: 0 0 14px; font-weight: 800; color: var(--text); letter-spacing: .2px; }
h2 { font-size: 20px; margin: 18px 0 10px; padding-left: 12px; position: relative; }
h2::before { content: ''; position: absolute; left: 0; top: 0.25em; width: 4px; height: 1.2em; border-radius: 4px; background: var(--btn-border); }
p { line-height: 1.8; margin: 8px 0; }
ul { list-style: none; padding: 0; margin: 6px 0 12px; }
ul li { position: relative; padding-left: 18px; margin: 6px 0; }
ul li::before { content: ''; position: absolute; left: 0; top: 0.6em; width: 8px; height: 8px; border-radius: 50%; background: var(--btn-border); }
.meta { color: var(--muted); font-size: 12px; margin: -2px 0 12px; }
.muted { color: var(--muted); }
</style>
