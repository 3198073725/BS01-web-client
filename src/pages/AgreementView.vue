<template>
  <div class="agreement-page">
    <header class="page-header">
      <button class="back-btn" @click="$router.back()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        返回
      </button>
      <h1>用户协议</h1>
      <p class="date-info">最后更新：2025年12月10日</p>
    </header>
    <main class="content">
      <article>
        <p>欢迎使用本平台。请您仔细阅读以下条款，如果您对本协议的任何条款表示异议，可以选择不进入本平台。当您注册成功，无论是进入本平台，还是在本平台上发布任何内容（即「内容」），均意味着您（即「用户」）完全接受本协议项下的全部条款。</p>

        <h2>使用规则</h2>
        <p>用户注册成功后，将给予每个用户一个用户账号及相应的密码，该用户账号和密码由用户负责保管；用户应当对以其用户账号进行的所有活动和事件负法律责任。</p>
        <p>用户须对在本平台的注册信息的真实性、合法性、有效性承担全部责任，用户不得冒充他人；不得利用他人的名义发布任何信息；不得恶意使用注册账号导致其他用户误认；否则本平台有权立即停止提供服务，收回其账号并由用户独自承担由此而产生的一切法律责任。</p>

        <h2>内容规范</h2>
        <p>用户在本平台发布的内容（包括但不限于文字、图片、视频、音频等）不得违反国家法律法规，不得包含以下内容：</p>
        <ul>
          <li>反对宪法所确定的基本原则的；</li>
          <li>危害国家安全，泄露国家秘密，颠覆国家政权，破坏国家统一的；</li>
          <li>损害国家荣誉和利益的；</li>
          <li>煽动民族仇恨、民族歧视，破坏民族团结的；</li>
          <li>破坏国家宗教政策，宣扬邪教和封建迷信的；</li>
          <li>散布谣言，扰乱社会秩序，破坏社会稳定的；</li>
          <li>散布淫秽、色情、赌博、暴力、凶杀、恐怖或者教唆犯罪的。</li>
        </ul>

        <h2>知识产权</h2>
        <p>用户在本平台发布的原创内容，著作权归用户本人所有。用户同意授予本平台一项全球范围内的、免许可费的、非独家的、可再许可的使用权，以便本平台对相关内容进行存储、使用、复制、修改、改编、出版、翻译、创作衍生作品、传播、表演和展示等。</p>

        <h2>免责声明</h2>
        <p>本平台不对用户发布内容的真实性、合法性负责，用户应自行评估内容的可靠性。因网络状况、通讯线路或第三方技术故障等不可抗力原因导致的服务中断，本平台不承担责任。</p>

        <h2>协议修改</h2>
        <p>本平台有权在必要时修改本协议条款。修改后的协议将公示，并自发布之日起生效。如您不同意修改后的协议，应当停止使用本平台服务。继续使用即视为接受修改后的协议。</p>

        <p>本协议最终解释权归本平台所有。</p>
      </article>
    </main>
  </div>
</template>

<script setup>
// 无需额外逻辑，仅模板展示
</script>

<style scoped>
.agreement-page {
  padding: 20px;
  color: var(--text);
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  font-size: 14px;
  color: var(--text);
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  transition: background 0.2s;
}
.back-btn:hover {
  background: var(--hover-bg);
}

h1 {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
  color: var(--text);
}

.date-info {
  margin-left: auto;
  font-size: 13px;
  color: var(--muted);
}

.content {
  max-width: 100%;
}

article {
  padding: 0;
  text-align: justify;
}

h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 28px 0 12px;
  color: var(--text);
}

p {
  margin: 12px 0;
  color: var(--text);
  line-height: 1.6;
}

ul {
  margin: 8px 0 16px;
  padding-left: 24px;
  color: var(--text);
}

li {
  margin: 6px 0;
  line-height: 1.6;
}

@media (max-width: 640px) {
  .agreement-page {
    padding: 12px;
  }
  
  .page-header {
    flex-wrap: wrap;
    gap: 12px;
  }
  
  .date-info {
    margin-left: 0;
    width: 100%;
  }
  
  h1 {
    font-size: 20px;
  }
  
  h2 {
    font-size: 16px;
  }
}
</style>