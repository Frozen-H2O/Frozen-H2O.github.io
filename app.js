const playedManifestPath = 'data/games.json';
const backlogManifestPath = 'data/backlog.json';
let games = [];
let backlogGames = [];
let activeView = 'played';

const formatDate = (timestamp) => timestamp ? new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', day: 'numeric' }).format(new Date(timestamp * 1000)) : 'Dropped';
const formatHours = (hours) => `${Number(hours).toFixed(Number(hours) % 1 ? 1 : 0)} hours`;
const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]);

async function loadCollection(manifestPath) {
    const manifest = await fetch(manifestPath).then(response => {
        if (!response.ok)
            throw new Error(`Could not load ${manifestPath}`);
        return response.json();
    });
    const loadedGames = await Promise.all(manifest.games.map(async path => {
        try {
            const response = await fetch(path);
            if (!response.ok)
                throw new Error(`Request returned ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`Could not load game file: ${path}`, error);
            return null;
        }
    }));
    return loadedGames.filter(Boolean);
}

async function loadGames() {
    const [playedResult, backlogResult] = await Promise.allSettled([
        loadCollection(playedManifestPath),
        loadCollection(backlogManifestPath)
    ]);
    games = playedResult.status === 'fulfilled' ? playedResult.value : [];
    backlogGames = backlogResult.status === 'fulfilled' ? backlogResult.value : [];
    if (playedResult.status === 'rejected' || backlogResult.status === 'rejected')
        console.error('One or more game lists could not be loaded.', playedResult.reason, backlogResult.reason);

    activeView = new URLSearchParams(window.location.search).get('view') === 'backlog' ? 'backlog' : 'played';
    render();
    const requestedGame = new URLSearchParams(window.location.search).get('game');
    if (requestedGame && activeView === 'played')
        openGame(requestedGame, { updateURL: false });
}

function completion(game) {
    return game.completion?.post_game || game.completion?.main || 0;
}

function sortGames(list, method) {
    return [...list].sort((a, b) => {
        if (method === 'alphabetical')
            return a.name.localeCompare(b.name);
        if (method === 'rating-desc')
            return Number(b.rating?.score || 0) - Number(a.rating?.score || 0);
        if (method === 'rating-asc')
            return Number(a.rating?.score || 0) - Number(b.rating?.score || 0);
        if (method === 'playtime-desc')
            return Number(b.playtime_hours || 0) - Number(a.playtime_hours || 0);
        if (method === 'playtime-asc')
            return Number(a.playtime_hours || 0) - Number(b.playtime_hours || 0);
        return completion(b) - completion(a);
    });
}

function sortBacklogGames(list) {
    return [...list].sort((a, b) => {
        if (Number(a.playtime_hours || 0) > 0 || Number(b.playtime_hours || 0) > 0)
            return Number(b.playtime_hours || 0) - Number(a.playtime_hours || 0);
        const aRated = Number(a.rating?.score || 0) > 0;
        const bRated = Number(b.rating?.score || 0) > 0;
        return Number(bRated) - Number(aRated) || a.name.localeCompare(b.name);
    });
}

function ratingMarkup(score) {
    if (score <= 0 || score > 10)
        return '';
    const color = score < 4 ? 'bad' : score < 7 ? 'decent' : score < 10 ? 'good' : 'gold';
    return `<span class="score" style="background-color: var(--${color}-game-background)">${score}/10</span>`;
}

function cardTemplate(game, isBacklog = false) {
    const image = game.images?.cover_vertical || game.images?.cover_horizontal || game.images?.background || '';
    const score = Number(game.rating?.score || 0);
    const playtime = Number(game.playtime_hours || 0);
    const showScore = score > 0 && score <= 10;
    const showPlaytime = playtime > 0;
    const meta = showPlaytime ? `<p class="card-meta"><span>${formatHours(playtime)}</span></p>` : '';
    const content = `
        <div class="card-art">
            ${image ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(game.name)} coverart" />` : `<div class='placeholder'>${escapeHTML(game.name)}</div>`}
            <div class="art-shade"></div>
            ${showScore ? ratingMarkup(score) : ''}
        </div>
        <div class="card-body">${meta}</div>`;

    if (isBacklog) {
        return game.link
            ? `<a class="game-card" target="_blank" href="${escapeHTML(game.link)}" aria-label="Open Pokémon ${escapeHTML(game.name)}">${content}</a>`
            : `<div class="game-card game-card-unavailable" aria-label="Pokémon ${escapeHTML(game.name)} has no game page link">${content}</div>`;
    }
    return `<button class="game-card" data-id="${escapeHTML(game.id)}" aria-label="Open Pokémon ${escapeHTML(game.name)} review">${content}</button>`;
}

function render() {
    const isBacklog = activeView === 'backlog';
    const list = isBacklog ? backlogGames : games;
    const ordered = isBacklog ? sortBacklogGames(list) : sortGames(list, document.querySelector('#sort').value);
    const grid = document.querySelector('#game-grid');
    grid.innerHTML = ordered.map(game => cardTemplate(game, isBacklog)).join('');
    document.querySelector('#game-count').textContent = isBacklog ? `${list.length} game${list.length == 1 ? '' : 's'}` : '';
    document.querySelector('#sort-control').hidden = isBacklog;
    document.querySelector('#empty-state').hidden = list.length > 0;

    document.querySelectorAll('.view-toggle-button').forEach(button => {
        const selected = button.dataset.view === activeView;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-selected', String(selected));
    });
    grid.querySelectorAll('button.game-card').forEach(card => card.addEventListener('click', () => openGame(card.dataset.id)));

    const totalHours = games.reduce((sum, game) => sum + Number(game.playtime_hours || 0), 0);
    const average = games.length ? (games.reduce((sum, game) => sum + Number(game.rating?.score || 0), 0) / games.length).toFixed(1) : '—';
    document.querySelector('#stats').innerHTML = `<div class="stat"><strong>${games.length}</strong><span>games played</span></div><div class="stat"><strong>${totalHours.toFixed(1)}h</strong><span>total playtime</span></div><div class="stat"><strong>${average}</strong><span>average rating</span></div>`;
}

function reviewHTML(review) {
    return escapeHTML(review || 'No review written yet.').split(/\n\s*\n/).map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`).join('');
}

function updateDialogScrollCues() {
    const dialog = document.querySelector('#game-dialog');
    if (!dialog.open)
        return;
    const remainingScroll = dialog.scrollHeight - dialog.clientHeight - dialog.scrollTop;
    const hasOverflow = dialog.scrollHeight > dialog.clientHeight + 2;
    dialog.classList.toggle('has-hidden-above', hasOverflow && dialog.scrollTop > 2);
    dialog.classList.toggle('has-hidden-below', hasOverflow && remainingScroll > 2);

    const bounds = dialog.getBoundingClientRect();
    dialog.style.setProperty('--dialog-left', `${bounds.left}px`);
    dialog.style.setProperty('--dialog-width', `${bounds.width}px`);
    dialog.style.setProperty('--dialog-top', `${bounds.top}px`);
    dialog.style.setProperty('--dialog-bottom', `${bounds.bottom}px`);
}

function openGame(id, { updateURL = true } = {}) {
    const game = games.find(item => item.id === id);
    if (!game)
        return;
    const hero = game.images?.background || game.images?.cover_horizontal || game.images?.cover_vertical || '';
    const screenshots = (game.images?.screenshots || []).map((src, index) => `<div class="screenshot-frame"><img src="${escapeHTML(src)}" alt="Pokémon ${escapeHTML(game.name)} screenshot ${index + 1}" loading="lazy" /></div>`).join('');
    document.querySelector('#dialog-content').innerHTML = `
        ${game.link ? `<a href="${escapeHTML(game.link)}" target="_blank">` : ''}
            <div class="dialog-hero">
                ${hero ? `<img src="${escapeHTML(hero)}" alt="Game background image" />` : ''}
                <div class="dialog-title">
                    ${game.images?.logo ? `<img src="${escapeHTML(game.images.logo)}" alt="Pokémon ${escapeHTML(game.name)}" />` : `<h2>Pokémon ${escapeHTML(game.name)}</h2>`}
                </div>
            </div>
        ${game.link ? '</a>' : ''}
        <div class="dialog-main">
            <div class="dialog-rating">
                <div class="rating-number">${Number(game.rating?.score || 0)}<span>/</span><small>10</small></div>
                <div class="rating-label">${game.rating?.label ? escapeHTML('- ' + game.rating.label) : ''}</div>
            </div>
            <dl class="detail-list">
                <div><dt>Playtime</dt><dd>${formatHours(game.playtime_hours || 0)}</dd></div>
                <div><dt>Difficulty</dt><dd>${game.difficulty ? escapeHTML(game.difficulty) : 'Default'}</dd></div>
                <div><dt>${game.completion?.dropped ? 'Dropped' : 'Completed'}</dt><dd>${formatDate(completion(game))}</dd></div>
            </dl>
            <section class="review"><h3>Review</h3>${reviewHTML(game.review)}</section>
            ${screenshots ? `<section class="screenshots"><h3>Gallery</h3><div class="screenshot-row">${screenshots}</div></section>` : ''}
        </div>`;
    const dialog = document.querySelector('#game-dialog');
    if (!dialog.open)
        dialog.showModal();
    dialog.scrollTop = 0;
    requestAnimationFrame(updateDialogScrollCues);
    dialog.querySelectorAll('img').forEach(image => image.addEventListener('load', updateDialogScrollCues, { once: true }));
    if (updateURL)
        setGameParameter(id);
}

function setGameParameter(id) {
    const url = new URL(window.location.href);
    if (id)
        url.searchParams.set('game', id);
    else
        url.searchParams.delete('game');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function setViewParameter(view) {
    const url = new URL(window.location.href);
    if (view === 'backlog')
        url.searchParams.set('view', 'backlog');
    else
        url.searchParams.delete('view');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

document.querySelector('#sort').addEventListener('change', render);
document.querySelectorAll('.view-toggle-button').forEach(button => button.addEventListener('click', () => {
    activeView = button.dataset.view;
    setViewParameter(activeView);
    render();
}));
document.querySelector('#close-dialog').addEventListener('click', () => document.querySelector('#game-dialog').close());
document.querySelector('#game-dialog').addEventListener('click', event => {
    if (event.target.id === 'game-dialog')
        event.currentTarget.close();
});
document.querySelector('#game-dialog').addEventListener('scroll', updateDialogScrollCues, { passive: true });
window.addEventListener('resize', updateDialogScrollCues);
document.querySelector('#game-dialog').addEventListener('close', () => {
    if (new URLSearchParams(window.location.search).has('game'))
        setGameParameter(null);
});
window.addEventListener('popstate', () => {
    const requestedGame = new URLSearchParams(window.location.search).get('game');
    const dialog = document.querySelector('#game-dialog');
    if (requestedGame)
        openGame(requestedGame, { updateURL: false });
    else if (dialog.open)
        dialog.close();
});
loadGames();
