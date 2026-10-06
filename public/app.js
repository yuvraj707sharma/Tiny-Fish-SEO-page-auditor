let currentReport = null;

document.addEventListener('DOMContentLoaded', () => {
  const auditForm = document.getElementById('auditForm');
  const urlInput = document.getElementById('urlInput');
  const queryInput = document.getElementById('queryInput');
  const submitBtn = document.getElementById('submitBtn');
  const loadingSection = document.getElementById('loadingSection');
  const resultsSection = document.getElementById('resultsSection');

  // Tab switching
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // Sample Buttons
  const demoBtns = document.querySelectorAll('.demo-btn');
  demoBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const sampleUrl = btn.getAttribute('data-url');
      if (sampleUrl) {
        urlInput.value = sampleUrl;
        queryInput.value = '';
        runLiveAudit(sampleUrl, '');
      }
    });
  });

  // Form Submit
  auditForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    const query = queryInput.value.trim();
    if (!url) return;
    runLiveAudit(url, query);
  });

  // Copy Buttons
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-copy');
      if (!currentReport) return;

      let textToCopy = '';
      if (type === 'answerCapsule') {
        textToCopy = currentReport.actionableFixes.aiAnswerCapsule;
      } else if (type === 'schemaCode') {
        textToCopy = currentReport.actionableFixes.jsonLdSchemaSnippet;
      } else if (type === 'llmsTxtCode') {
        textToCopy = currentReport.actionableFixes.llmsTxtSnippet;
      }

      navigator.clipboard.writeText(textToCopy).then(() => {
        const oldText = btn.textContent;
        btn.textContent = 'Copied! ✓';
        btn.style.background = '#ff6600';
        btn.style.color = '#ffffff';
        setTimeout(() => {
          btn.textContent = oldText;
          btn.style.background = '';
          btn.style.color = '';
        }, 2000);
      });
    });
  });

  // Copy Evidence Button
  const copyEvidenceBtn = document.getElementById('copyEvidenceBtn');
  if (copyEvidenceBtn) {
    copyEvidenceBtn.addEventListener('click', () => {
      if (!currentReport) return;
      navigator.clipboard.writeText(JSON.stringify(currentReport.evidence, null, 2)).then(() => {
        copyEvidenceBtn.textContent = 'Copied JSON! ✓';
        setTimeout(() => { copyEvidenceBtn.textContent = 'Copy Raw JSON'; }, 2000);
      });
    });
  }

  // Copy Report (Markdown)
  const copyReportBtn = document.getElementById('copyReportBtn');
  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', () => {
      if (!currentReport) return;
      const md = generateMarkdownReport(currentReport);
      navigator.clipboard.writeText(md).then(() => {
        copyReportBtn.textContent = 'Copied MD! ✓';
        setTimeout(() => { copyReportBtn.textContent = '📋 Copy Report (MD)'; }, 2000);
      });
    });
  }

  // Download JSON Report
  const downloadJsonBtn = document.getElementById('downloadJsonBtn');
  if (downloadJsonBtn) {
    downloadJsonBtn.addEventListener('click', () => {
      if (!currentReport) return;
      const blob = new Blob([JSON.stringify(currentReport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tinyfish-audit-${currentReport.targetUrl.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const errorBanner = document.getElementById('errorBanner');
  const errorTitle = document.getElementById('errorTitle');
  const errorMsg = document.getElementById('errorMsg');

  function showError(title, message) {
    if (errorBanner) {
      if (errorTitle) errorTitle.textContent = title;
      if (errorMsg) errorMsg.textContent = message;
      errorBanner.classList.remove('hidden');
    }
  }

  function hideError() {
    if (errorBanner) errorBanner.classList.add('hidden');
  }

  async function runLiveAudit(url, query) {
    hideError();
    loadingSection.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    submitBtn.disabled = true;

    // Progress animation
    const steps = ['step1', 'step2', 'step3', 'step4'];
    let curStep = 0;
    const interval = setInterval(() => {
      steps.forEach((s, idx) => {
        const el = document.getElementById(s);
        if (el) {
          if (idx <= curStep) el.classList.add('step-active');
          else el.classList.remove('step-active');
        }
      });
      curStep = (curStep + 1) % steps.length;
    }, 1200);

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, targetQuery: query })
      });

      const report = await res.json();
      clearInterval(interval);
      loadingSection.classList.add('hidden');
      submitBtn.disabled = false;

      if (!res.ok || report.error) {
        showError('Audit Failed', report.details || report.error || `Could not fetch "${url}". Ensure the domain exists, is online, and includes a valid URL.`);
        return;
      }

      currentReport = report;
      renderReport(report);
      resultsSection.classList.remove('hidden');
    } catch (err) {
      clearInterval(interval);
      loadingSection.classList.add('hidden');
      submitBtn.disabled = false;
      showError('Connection Error', `Failed to connect to auditor API: ${err.message}`);
    }
  }

  function renderReport(report) {
    // 1. Header Overview
    document.getElementById('reportUrl').textContent = report.finalUrl;
    document.getElementById('auditTimestamp').textContent = `Audited ${new Date(report.timestamp).toUTCString()}`;
    document.getElementById('overallScore').textContent = report.overallScore;
    document.getElementById('gradeBadge').textContent = report.grade;

    document.getElementById('statPassed').textContent = `${report.stats.passed} passed`;
    document.getElementById('statWarnings').textContent = `${report.stats.warnings} warnings`;
    document.getElementById('statFailed').textContent = `${report.stats.failed} failed`;
    document.getElementById('statChecks').textContent = `Checks: ${report.stats.checksCount}`;
    document.getElementById('statFixes').textContent = `Fixes: ${report.stats.fixesCount}`;
    document.getElementById('statSearchCalls').textContent = `Search calls: ${report.stats.searchCalls}`;
    document.getElementById('statFetchCalls').textContent = `Fetch calls: ${report.stats.fetchCalls}`;

    // 2. Top 3 Things to Fix Today
    const top3Container = document.getElementById('top3Container');
    top3Container.innerHTML = '';
    report.top3FixesToday.forEach(f => {
      const div = document.createElement('div');
      div.className = 'top3-card';
      div.innerHTML = `
        <div class="top3-header">
          <strong class="top3-title">${escapeHtml(f.title)}</strong>
          <span class="priority-badge p-${f.priority}">${f.priority}</span>
        </div>
        <div class="top3-action">${escapeHtml(f.action)}</div>
        <div class="top3-impact"><strong>Expected Benefit:</strong> ${escapeHtml(f.impact)}</div>
      `;
      top3Container.appendChild(div);
    });

    // 3. Category Scores
    const cats = report.categoryScores;
    document.getElementById('catTech').textContent = cats.technicalSeo;
    document.getElementById('catFillTech').style.width = `${cats.technicalSeo}%`;

    document.getElementById('catOnPage').textContent = cats.onPageSeo;
    document.getElementById('catFillOnPage').style.width = `${cats.onPageSeo}%`;

    document.getElementById('catContent').textContent = cats.contentEeat;
    document.getElementById('catFillContent').style.width = `${cats.contentEeat}%`;

    document.getElementById('catAiGeo').textContent = cats.aiGeoReadiness;
    document.getElementById('catFillAiGeo').style.width = `${cats.aiGeoReadiness}%`;

    document.getElementById('catVisibility').textContent = cats.searchVisibility;
    document.getElementById('catFillVisibility').style.width = `${cats.searchVisibility}%`;

    // 4. Tab 1: Detailed Standard SEO Checks
    const checksContainer = document.getElementById('checksContainer');
    checksContainer.innerHTML = '';
    report.detailedChecks.forEach(c => {
      const card = document.createElement('div');
      card.className = `check-card check-${c.status}`;
      card.innerHTML = `
        <div class="check-top-row">
          <div>
            <span class="check-status-tag status-${c.status}">${c.status}</span>
            <strong class="check-name" style="margin-left: 8px;">${escapeHtml(c.standardSeoTerm)}</strong>
          </div>
          <span class="check-meta">${c.score}/100 · ${escapeHtml(c.category)} · weight ${c.weight}</span>
        </div>
        <div class="check-plain-english">${escapeHtml(c.plainEnglishExplanation)}</div>
        <div class="check-summary"><strong>Finding:</strong> ${escapeHtml(c.summary)}</div>
        <div class="check-why-matters"><strong>Why it matters:</strong> ${escapeHtml(c.whyItMatters)}</div>
        <div class="check-tooltip"><small style="color: var(--text-muted)">💡 <em>Glossary:</em> ${escapeHtml(c.glossaryTooltip)}</small></div>
        ${c.fixAction ? `<div class="check-fix"><strong>Action:</strong> ${escapeHtml(c.fixAction)}</div>` : ''}
      `;
      checksContainer.appendChild(card);
    });

    // 5. Tab 2: Search Queries Table & Competitors
    const searchTable = document.getElementById('searchQueriesTableBody');
    searchTable.innerHTML = '';
    report.searchVisibilityTable.forEach(item => {
      const tr = document.createElement('tr');
      const rankBadge = item.isRanked
        ? `<span class="stat-pill pill-pass">Rank #${item.rankPosition}</span>`
        : `<span class="stat-pill pill-warn">Unranked in Top 10</span>`;
      tr.innerHTML = `
        <td><strong>${escapeHtml(item.query)}</strong></td>
        <td><span class="priority-badge p-P3">${escapeHtml(item.type)}</span> <span class="badge" style="font-size: 10px;">${escapeHtml(item.intent)}</span></td>
        <td>${rankBadge}</td>
        <td><small style="color: var(--text-muted);">${escapeHtml(item.source)}</small></td>
        <td>${escapeHtml(item.qualityNote)}</td>
      `;
      searchTable.appendChild(tr);
    });

    // Keyword Cannibalization
    const cannibalContainer = document.getElementById('cannibalizationContainer');
    if (report.cannibalizationAnalysis && report.cannibalizationAnalysis.length > 0 && report.cannibalizationAnalysis[0].isCannibalized) {
      const cann = report.cannibalizationAnalysis[0];
      cannibalContainer.innerHTML = `
        <div class="gap-alert-box" style="border-left: 3px solid #ffaa00; background: #1a1205;">
          <strong>⚠️ Keyword Cannibalization Risk Detected:</strong> ${escapeHtml(cann.note)}
          <div style="font-family: var(--font-mono); font-size: 12px; margin-top: 6px; color: #ffaa00;">${cann.competingUrls.map(u => escapeHtml(u)).join('<br>')}</div>
        </div>
      `;
      cannibalContainer.style.display = 'block';
    } else {
      cannibalContainer.style.display = 'none';
    }

    const gapBox = document.getElementById('gapAlertBox');
    if (report.competitorGap.missingMultiWordTopics.length > 0) {
      gapBox.innerHTML = `<strong>Topical Keyword Gap:</strong> Missing vs top competitor pages: <span style="color: var(--accent-orange); font-weight: bold;">${report.competitorGap.missingMultiWordTopics.join(', ')}</span>.<br><small style="color: var(--text-muted)">Consider adding dedicated sections covering these themes to increase multi-entity retrieval probability.</small>`;
    } else {
      gapBox.innerHTML = `✅ Excellent topical coverage! Content matches all primary search query entities.`;
    }

    const compList = document.getElementById('competitorsList');
    compList.innerHTML = '';
    if (report.competitorGap.competitorsAnalyzed.length === 0) {
      compList.innerHTML = '<p style="color: var(--text-muted)">No non-social competitor pages found for this query.</p>';
    } else {
      report.competitorGap.competitorsAnalyzed.forEach(c => {
        const div = document.createElement('div');
        div.className = 'competitor-card';
        div.innerHTML = `
          <span class="competitor-rank">Rank #${c.rank}</span>
          <div class="competitor-title">${escapeHtml(c.title)}</div>
          <div style="font-family: var(--font-mono); font-size: 11px; color: var(--accent-orange); word-break: break-all; margin-bottom: 8px;">${escapeHtml(c.url)}</div>
          <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 6px;"><strong>Key Sections Covered:</strong> ${c.headings.slice(0, 4).join(', ') || 'General Overview'}</div>
        `;
        compList.appendChild(div);
      });
    }

    // 6. Tab 3: Visibility Bridge
    const bridgeContainer = document.getElementById('bridgeContainer');
    bridgeContainer.innerHTML = '';
    report.visibilityBridge.forEach(b => {
      const card = document.createElement('div');
      card.className = 'bridge-card';
      card.innerHTML = `
        <div class="bridge-dim">${escapeHtml(b.dimension)}</div>
        <div class="bridge-obs">${escapeHtml(b.observation)}</div>
        <div class="bridge-impact"><strong>Search Impact:</strong> ${escapeHtml(b.searchImpact)}</div>
        <div class="bridge-data">${escapeHtml(b.verifiedDataPoint)}</div>
      `;
      bridgeContainer.appendChild(card);
    });

    // 7. Tab 4: E-E-A-T & SERP Preview
    const serp = report.onPageDetails.serpSnippetPreview;
    document.getElementById('serpUrlDisplay').textContent = report.finalUrl;
    document.getElementById('serpTitleDisplay').textContent = serp.titlePreview;
    document.getElementById('serpDescDisplay').textContent = serp.descriptionPreview;
    document.getElementById('serpPixelBadge').textContent = `Est. ~${serp.titlePixelWidthEst}px width (${serp.isTitleTruncated ? 'Truncated' : 'Fully Visible'})`;

    const ymylBadge = document.getElementById('ymylBadge');
    if (report.contentEeatDetails.ymylAnalysis.isYmyl) {
      ymylBadge.textContent = `YMYL: ${report.contentEeatDetails.ymylAnalysis.category}`;
      ymylBadge.className = 'badge badge-orange';
    } else {
      ymylBadge.textContent = 'Standard Niche';
      ymylBadge.className = 'badge badge-orange-outline';
    }

    const eeatContainer = document.getElementById('eeatContainer');
    const eeat = report.contentEeatDetails.eeatSignals;
    eeatContainer.innerHTML = `
      <div class="eeat-item">
        <span class="eeat-status ${eeat.aboutPage.found ? 'eeat-pass' : 'eeat-fail'}">${eeat.aboutPage.found ? '✓ Found' : '✗ Missing'}</span>
        <strong>About Page / Institutional Identity</strong>
        <div style="font-size: 11px; color: var(--text-muted);">${eeat.aboutPage.url ? `<a href="${escapeHtml(eeat.aboutPage.url)}" target="_blank" style="color: var(--accent-orange);">${escapeHtml(eeat.aboutPage.url)}</a>` : 'No dedicated About page link found in navigation.'}</div>
      </div>
      <div class="eeat-item">
        <span class="eeat-status ${eeat.contactPage.found ? 'eeat-pass' : 'eeat-fail'}">${eeat.contactPage.found ? '✓ Found' : '✗ Missing'}</span>
        <strong>Contact Details / Customer Support</strong>
        <div style="font-size: 11px; color: var(--text-muted);">${eeat.contactPage.url ? `<a href="${escapeHtml(eeat.contactPage.url)}" target="_blank" style="color: var(--accent-orange);">${escapeHtml(eeat.contactPage.url)}</a>` : 'No dedicated Contact page link found in navigation.'}</div>
      </div>
      <div class="eeat-item">
        <span class="eeat-status ${eeat.privacyPolicy.found ? 'eeat-pass' : 'eeat-fail'}">${eeat.privacyPolicy.found ? '✓ Found' : '✗ Missing'}</span>
        <strong>Privacy Policy & Legal Disclosures</strong>
        <div style="font-size: 11px; color: var(--text-muted);">${eeat.privacyPolicy.url ? `<a href="${escapeHtml(eeat.privacyPolicy.url)}" target="_blank" style="color: var(--accent-orange);">${escapeHtml(eeat.privacyPolicy.url)}</a>` : 'No Privacy Policy or Terms link detected in footer.'}</div>
      </div>
      <div class="eeat-item">
        <span class="eeat-status ${eeat.author.found ? 'eeat-pass' : 'eeat-warn'}">${eeat.author.found ? '✓ Found' : '⚠️ Missing'}</span>
        <strong>Author Byline & Content Attribution</strong>
        <div style="font-size: 11px; color: var(--text-muted);">${eeat.author.value ? escapeHtml(eeat.author.value) : 'No explicit author or byline tag found.'}</div>
      </div>
    `;

    // Local SEO (Conditional)
    const localCard = document.getElementById('localSeoCard');
    if (report.localSeoDetails && report.localSeoDetails.isLocalDetected) {
      const loc = report.localSeoDetails;
      localCard.style.display = 'block';
      const localContainer = document.getElementById('localContainer');
      localContainer.innerHTML = `
        <div class="local-item">
          <strong>Entity Type:</strong> ${escapeHtml(loc.businessType || 'Organization')}
        </div>
        <div class="local-item">
          <strong>Schema Address:</strong> ${escapeHtml(loc.schemaAddress || 'Not declared in schema')}
        </div>
        <div class="local-item">
          <strong>Visible Phone / NAP:</strong> ${escapeHtml(loc.visiblePhone || 'Not found')}
        </div>
        <div class="local-item">
          <strong>Google Maps Verification:</strong> ${loc.googleMapsLink ? `<a href="${escapeHtml(loc.googleMapsLink)}" target="_blank" style="color: var(--accent-orange);">Verified Google Maps Link ↗</a>` : 'No Google Maps link found.'}
        </div>
      `;
    } else {
      localCard.style.display = 'none';
    }

    // 8. Tab 5: Fixes
    document.getElementById('answerCapsuleCode').textContent = report.actionableFixes.aiAnswerCapsule;
    document.getElementById('schemaCode').textContent = report.actionableFixes.jsonLdSchemaSnippet;
    document.getElementById('llmsTxtCode').textContent = report.actionableFixes.llmsTxtSnippet;

    const headingPlanList = document.getElementById('headingPlanList');
    headingPlanList.innerHTML = '';
    report.actionableFixes.suggestedHeadingHierarchy.forEach(h => {
      const div = document.createElement('div');
      div.className = 'heading-plan-item';
      div.innerHTML = `<strong>${h.tag}:</strong> ${escapeHtml(h.text)} <br><span style="color: var(--text-muted); font-size: 11px;">(${escapeHtml(h.reason)})</span>`;
      headingPlanList.appendChild(div);
    });

    // 9. Tab 6: Beyond Single URL (Out of Scope)
    const scopeContainer = document.getElementById('scopeContainer');
    scopeContainer.innerHTML = '';
    report.outOfScopePanels.forEach(p => {
      const div = document.createElement('div');
      div.className = 'scope-card';
      div.innerHTML = `
        <div class="scope-term">${escapeHtml(p.term)}</div>
        <div class="scope-def">${escapeHtml(p.definition)}</div>
        <div class="scope-why"><strong>Why it matters:</strong> ${escapeHtml(p.whyItMatters)}</div>
        <div class="scope-tools"><strong>Recommended Tools:</strong> ${escapeHtml(p.recommendedTools)}</div>
      `;
      scopeContainer.appendChild(div);
    });

    // 10. Tab 7: Evidence & Consistency
    const consistencyContainer = document.getElementById('consistencyContainer');
    consistencyContainer.innerHTML = `
      <div class="consistency-stat">
        <span class="label">Raw DOM Headings</span>
        <span class="value">${report.dataConsistency.rawHtmlHeadingsCount}</span>
      </div>
      <div class="consistency-stat">
        <span class="label">Fetch Markdown Headings</span>
        <span class="value">${report.dataConsistency.fetchMarkdownHeadingsCount}</span>
      </div>
      <div class="consistency-stat">
        <span class="label">JS Dependency</span>
        <span class="value">${report.dataConsistency.jsDependencyPercentage}%</span>
      </div>
      <div class="consistency-stat">
        <span class="label">JSON-LD Blocks</span>
        <span class="value">${report.dataConsistency.jsonLdBlocksCount}</span>
      </div>
      <div style="grid-column: 1 / -1; font-size: 12px; color: var(--text-muted); background: #000; padding: 10px; border-radius: 4px; border: 1px solid var(--border-subtle);">
        <strong>Consistency Audit:</strong> ${escapeHtml(report.dataConsistency.headingsDiffNote)}
      </div>
    `;

    document.getElementById('evidenceJsonViewer').textContent = JSON.stringify(report.evidence, null, 2);
  }

  function generateMarkdownReport(r) {
    return `# TinyFish Professional SEO Page Audit: ${r.finalUrl}
**Timestamp:** ${r.timestamp}
**Overall Score:** ${r.overallScore}/100 (${r.grade})

## Category Scores
- Technical SEO: ${r.categoryScores.technicalSeo}/100
- On-page SEO: ${r.categoryScores.onPageSeo}/100
- Content & E-E-A-T: ${r.categoryScores.contentEeat}/100
- AI & GEO Readiness: ${r.categoryScores.aiGeoReadiness}/100
- Search Visibility: ${r.categoryScores.searchVisibility}/100

## Top 3 Things to Fix Today
${r.top3FixesToday.map((f, i) => `${i + 1}. **[${f.priority}] ${f.title}**: ${f.action}\n   *Expected Benefit:* ${f.impact}`).join('\n')}

## Standard SEO Checks
${r.detailedChecks.map(c => `- **[${c.status}] ${c.standardSeoTerm}** (${c.score}/100 · ${c.category}): ${c.summary}`).join('\n')}
`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
});
