function loadProfile() {
    try {
        const data = localStorage.getItem('mathexUserProfile_v3');
        return data ? JSON.parse(data) : { sessionHistory: [] };
    } catch (e) {
        console.error('Failed to load profile', e);
        return { sessionHistory: [] };
    }
}

function formatTime(ms, showDecimals = true) {
    if (ms === null || typeof ms !== 'number' || isNaN(ms) || ms < 0) return showDecimals ? '0.00s' : '0s';
    if (showDecimals && ms < 60000) {
        return `${(ms / 1000).toFixed(2)}s`;
    } else {
        const totalSeconds = Math.round(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    }
}

function sanitizeHTML(str) {
    if (!str) return '';
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

function renderResults(session) {
    const details = session.details || [];
    const summary = session.summary || {};
    const settings = session.settings || {};

    const accuracyEl = document.getElementById('reviewAccuracyNumber');
    const correctEl = document.getElementById('reviewCorrectNumber');
    const incorrectEl = document.getElementById('reviewIncorrectNumber');
    const skippedEl = document.getElementById('reviewSkippedNumber');
    const streakEl = document.getElementById('reviewStreakNumber');
    const challengeScoreNumEl = document.getElementById('reviewChallengeScoreNumber');
    const challengeScoreContEl = document.getElementById('reviewChallengeScoreContainer');
    const pieContainerEl = document.getElementById('reviewPieChartContainer');
    const pieLegendEl = document.getElementById('reviewPieChartLegend');
    const timeGraphEl = document.getElementById('reviewTimeGraph');
    const avgTimeEl = document.getElementById('reviewAvgTimeNumber');
    const fastestEl = document.getElementById('reviewFastestNumber');
    const slowestEl = document.getElementById('reviewSlowestNumber');
    const totalTimeEl = document.getElementById('reviewTotalTimeNumber');
    const detailTableBodyEl = document.getElementById('reviewDetailTableBody');
    const mobileDetailContEl = document.getElementById('reviewMobileDetailContainer');

    const validTimesMs = details
        .filter(d => d.status !== 'skipped' && typeof d.timeMs === 'number' && !isNaN(d.timeMs))
        .map(d => d.timeMs);
    const avgTimeMs = validTimesMs.length > 0 ? validTimesMs.reduce((a,b)=>a+b,0)/validTimesMs.length : 0;
    const fastestTimeMs = validTimesMs.length > 0 ? Math.min(...validTimesMs) : 0;
    const slowestTimeMs = validTimesMs.length > 0 ? Math.max(...validTimesMs) : 0;

    if (accuracyEl) accuracyEl.textContent = `${(summary.accuracy||0).toFixed(1)}%`;
    if (correctEl) correctEl.textContent = summary.correct || 0;
    if (incorrectEl) incorrectEl.textContent = summary.incorrect || 0;
    if (skippedEl) skippedEl.textContent = summary.skipped || 0;
    if (streakEl) streakEl.textContent = session.maxStreak || 0;
    if (totalTimeEl) totalTimeEl.textContent = formatTime(summary.durationMs || 0, false);

    if (avgTimeEl) avgTimeEl.textContent = formatTime(avgTimeMs, true);
    if (fastestEl) fastestEl.textContent = formatTime(fastestTimeMs, true);
    if (slowestEl) slowestEl.textContent = formatTime(slowestTimeMs, true);

    if (challengeScoreContEl && challengeScoreNumEl) {
        if (settings.isChallengeMode) {
            challengeScoreNumEl.textContent = settings.challengeScore.toFixed(1);
            challengeScoreContEl.style.display = 'block';
        } else {
            challengeScoreContEl.style.display = 'none';
        }
    }

    renderPieChart(pieContainerEl, pieLegendEl, summary.correct||0, summary.incorrect||0, summary.skipped||0);
    renderTimeGraph(timeGraphEl, details);
    renderDetailResultsTable(detailTableBodyEl, mobileDetailContEl, details, avgTimeMs);
}

function renderTimeGraph(container, details) {
    if (!container) return;
    container.innerHTML = '';

    if (details.length === 0) {
        container.innerHTML = '<div style="color: var(--text-secondary); font-style: italic; padding-left: 10px;">No time data available.</div>';
        return;
    }

    const timesMs = details.map(d => (d.status !== 'skipped' && d.timeMs ? d.timeMs : 0));
    const maxTime = Math.max(...timesMs, 1);
    let graphHeight = container.clientHeight;
    if (!graphHeight || graphHeight < 50) {
        graphHeight = window.innerWidth > 600 ? 250 : 150;
    }
    const maxBarHeight = Math.max(50, graphHeight * 0.9);
    const minBarHeight = 5;

    details.forEach((detail, i) => {
        const timeMs = (detail.status !== 'skipped' && detail.timeMs) ? detail.timeMs : 0;
        const height = Math.max(minBarHeight, (timeMs / maxTime) * maxBarHeight);

        const barContainer = document.createElement('div');
        barContainer.classList.add('bar');

        const barInner = document.createElement('div');
        barInner.classList.add('bar-inner', detail.status);
        barInner.style.height = height + 'px';

        const label = document.createElement('div');
        label.classList.add('bar-label');
        label.textContent = `${i + 1}`;

        barContainer.appendChild(barInner);
        barContainer.appendChild(label);
        container.appendChild(barContainer);
    });
}

function renderDetailResultsTable(tableBody, mobileContainer, details, avgMs) {
    if (!tableBody || !mobileContainer) return;
    tableBody.innerHTML = '';
    const mobileHeading = mobileContainer.querySelector('.subheading');
    mobileContainer.innerHTML = '';
    if (mobileHeading) mobileContainer.appendChild(mobileHeading);

    if (details.length === 0) {
        const noDataMsg = '<div style="text-align: center; color: var(--text-secondary); font-style: italic;">No details available.</div>';
        tableBody.innerHTML = `<tr><td colspan="4">${noDataMsg}</td></tr>`;
        mobileContainer.insertAdjacentHTML('beforeend', noDataMsg);
        return;
    }

    const fastThreshold = avgMs > 0 ? avgMs * 0.75 : Infinity;
    const slowThreshold = avgMs > 0 ? avgMs * 1.25 : 0;

    details.forEach((qd, i) => {
        const timeMs = qd.timeMs;
        const timeText = qd.status === 'skipped' ? '-' : formatTime(timeMs, true);
        const questionNum = i + 1;
        const userAnswerDisplay = (qd.status === 'skipped') ? '-' : (sanitizeHTML(qd.userAnswer) || '-');
        const correctAnswerDisplay = sanitizeHTML(qd.correctAnswer);
        const questionTextDisplay = sanitizeHTML(qd.questionText);
        const difficultyText = qd.difficulty === 'targeted' ? 'Targeted' : (sanitizeHTML(qd.difficulty) || 'N/A');

        let statusPillClass = 'pill-skipped', statusText = 'Skipped';
        if (qd.status === 'correct') { statusPillClass = 'pill-correct'; statusText = 'Correct'; }
        else if (qd.status === 'incorrect') { statusPillClass = 'pill-incorrect'; statusText = 'Incorrect'; }
        const statusPillHTML = `<span class="pill ${statusPillClass}">${statusText}</span>`;

        let speedPillHTML = '';
        if (qd.status !== 'skipped' && avgMs > 0 && timeMs !== null && timeMs >= 0) {
            let speedText = 'Average', speedClass = 'pill-average';
            if (timeMs <= fastThreshold) { speedText = 'Fast'; speedClass = 'pill-fast'; }
            else if (timeMs >= slowThreshold) { speedText = 'Slow'; speedClass = 'pill-slow'; }
            speedPillHTML = ` <span class="pill ${speedClass}">${speedText}</span>`;
        }

        const difficultySpanHTML = (difficultyText !== 'Targeted' && difficultyText !== 'N/A')
            ? `<span style='font-size:0.85em; color:var(--text-secondary); margin-left: 5px;'>[${difficultyText}]</span>`
            : '';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td data-label="Question">Q${questionNum}: ${questionTextDisplay}${difficultySpanHTML} ${statusPillHTML}</td>
            <td data-label="Correct Answer">${correctAnswerDisplay}</td>
            <td data-label="Your Answer">${userAnswerDisplay}</td>
            <td data-label="Time Taken">${timeText}${speedPillHTML}</td>
        `;
        tableBody.appendChild(row);

        const card = document.createElement('div');
        card.className = 'mobile-detail-card';
        card.innerHTML = `
          <div class="mobile-detail-header">
            <div class="mobile-detail-question">Q${questionNum}: ${questionTextDisplay} ${difficultySpanHTML}</div>
            <div class="mobile-detail-status">${statusPillHTML}</div>
          </div>
          <div class="mobile-detail-body">
            <div class="mobile-detail-row">
              <span>Correct Answer:</span>
              <span>${correctAnswerDisplay}</span>
            </div>
            <div class="mobile-detail-row">
              <span>Your Answer:</span>
              <span>${userAnswerDisplay}</span>
            </div>
            <div class="mobile-detail-row">
              <span>Time Taken:</span>
              <span>${timeText}${speedPillHTML}</span>
            </div>
          </div>`;
        mobileContainer.appendChild(card);
    });
}

function renderPieChart(container, legendContainer, correct, incorrect, skipped) {
    if (!container || !legendContainer) return;
    const total = correct + incorrect + skipped;
    container.innerHTML = '';
    legendContainer.innerHTML = '';

    if (total === 0) {
        container.innerHTML = '<div class="pie-chart-placeholder" style="color: var(--text-secondary); font-style: italic; padding: 20px 0;">No data for chart.</div>';
        return;
    }

    const percentages = {
        correct: (correct / total) * 100,
        incorrect: (incorrect / total) * 100,
        skipped: (skipped / total) * 100,
    };

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('role', 'img');

    const radius = 40, circumference = 2 * Math.PI * radius, strokeWidth = 20;
    let currentAngle = 0;

    const segments = [
        { value: percentages.correct, colorVar: '--pill-correct-bg', label: 'Correct', count: correct },
        { value: percentages.incorrect, colorVar: '--pill-incorrect-bg', label: 'Incorrect', count: incorrect },
        { value: percentages.skipped, colorVar: '--pill-skipped-bg', label: 'Skipped', count: skipped },
    ];

    const computedStyle = getComputedStyle(document.documentElement);

    segments.forEach(segment => {
        if (segment.value <= 0) return;
        const segmentLength = (segment.value / 100) * circumference;
        const dashOffset = circumference - (segmentLength * 0.999);

        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('cx', 50);
        circle.setAttribute('cy', 50);
        circle.setAttribute('r', radius);
        const strokeColor = computedStyle.getPropertyValue(segment.colorVar).trim() || '#ccc';
        circle.setAttribute('stroke', strokeColor);
        circle.setAttribute('stroke-width', strokeWidth);
        circle.setAttribute('stroke-dasharray', `${circumference} ${circumference}`);
        circle.setAttribute('transform', `rotate(${currentAngle} 50 50)`);
        circle.setAttribute('stroke-dashoffset', circumference);
        circle.style.transition = 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)';

        svg.appendChild(circle);
        setTimeout(() => { circle.style.strokeDashoffset = dashOffset; }, 50);
        currentAngle += (segment.value / 100) * 360;

        if (segment.count > 0) {
            const legendItem = document.createElement('span');
            legendItem.style.setProperty('--color', strokeColor);
            legendItem.textContent = `${segment.label}: ${segment.count} (${segment.value.toFixed(1)}%)`;
            legendContainer.appendChild(legendItem);
        }
    });

    container.appendChild(svg);
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const profile = loadProfile();
    let session = profile.sessionHistory.find(s => s.sessionId === id);
    if (!session) session = profile.sessionHistory[0];
    if (session) {
        const title = document.getElementById('reviewDetailTitle');
        if (title) title.textContent = `Session Review - ${new Date(session.startTime).toLocaleDateString()}`;
        renderResults(session);
    }
});
