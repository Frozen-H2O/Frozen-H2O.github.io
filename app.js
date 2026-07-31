const manifestPath = 'data/games.json';
let games = [];

const formatDate = (timestamp) => timestamp ? new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', day: 'numeric' }).format(new Date(timestamp * 1000)) : 'Dropped';
const formatHours = (hours) => `${Number(hours).toFixed(Number(hours) % 1 ? 1 : 0)} hours`;
const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]);

async function loadGames() {
    try {
        const manifest = await fetch(manifestPath).then(response => {
            if (!response.ok)
                throw new Error('Could not load game manifest');
            return response.json();
        });
        games = await Promise.all(manifest.games.map(path => fetch(path).then(response => response.json())));
    } catch (error) {
        console.error(error);
        games = [];
    }
    render();
    const requestedGame = new URLSearchParams(window.location.search).get('game');
    if (requestedGame)
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
            return b.rating.score - a.rating.score;
        if (method === 'rating-asc')
            return a.rating.score - b.rating.score;
        if (method === 'playtime-desc')
            return b.playtime_hours - a.playtime_hours;
        if (method === 'playtime-asc')
            return a.playtime_hours - b.playtime_hours;
        return completion(b) - completion(a);
    });
}

function cardTemplate(game) {
    const image = game.images?.cover_vertical || game.images?.cover_horizontal || game.images?.background || '';
    return `<button class="game-card" data-id="${escapeHTML(game.id)}" aria-label="Open Pokémon ${escapeHTML(game.name)} review">
        <div class="card-art">
            ${image ? `<img src="${escapeHTML(image)}" alt="" />` : ''}
            <div class="art-shade"></div>
            <span class="score" style="background-color: var(--${(game.rating.score < 4) ? 'bad' : (game.rating.score < 7) ? 'decent' : (game.rating.score < 10) ? 'good' : 'gold'}-game-background)">${game.rating.score}/10</span>
        </div>
        <div class="card-body">
            <p class="card-meta">
                <span>${formatHours(game.playtime_hours)}</span>
            </p>
        </div>
    </button>`;
}

function render() {
    const grid = document.querySelector('#game-grid');
    const ordered = sortGames(games, document.querySelector('#sort').value);
    grid.innerHTML = ordered.map(cardTemplate).join('');
    document.querySelector('#game-count').textContent = `(${games.length})`;
    document.querySelector('#empty-state').hidden = games.length > 0;
    const totalHours = games.reduce((sum, game) => sum + Number(game.playtime_hours || 0), 0);
    const average = games.length ? (games.reduce((sum, game) => sum + Number(game.rating.score || 0), 0) / games.length).toFixed(1) : '—';
    document.querySelector('#stats').innerHTML = `<div class="stat"><strong>${games.length}</strong><span>games played</span></div><div class="stat"><strong>${totalHours.toFixed(1)}h</strong><span>total playtime</span></div><div class="stat"><strong>${average}</strong><span>average rating</span></div>`;
    grid.querySelectorAll('.game-card').forEach(card => card.addEventListener('click', () => openGame(card.dataset.id)));
}

function reviewHTML(review) {
    return escapeHTML(review || 'No review written yet.').split(/\n\s*\n/).map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`).join('');
}

function openGame(id, { updateURL = true } = {}) {
    const game = games.find(item => item.id === id);
    if (!game)
        return;
    const hero = game.images?.background || game.images?.cover_horizontal || game.images?.cover_vertical || '';
    const screenshots = (game.images?.screenshots || []).map((src, index) => `<div class="screenshot-frame"><img src="${escapeHTML(src)}" alt="Pokémon ${escapeHTML(game.name)} screenshot ${index + 1}" loading="lazy" /></div>`).join('');
    const postGame = game.completion?.post_game ? `<div><dt>Post-game</dt><dd>${formatDate(game.completion.post_game)}</dd></div>` : '';
    document.querySelector('#dialog-content').innerHTML = `
    
        ${game.link ? `<a href="${escapeHTML(game.link)}" target="_blank">` : ''}
            <div class="dialog-hero">
                ${hero ? `<img src="${escapeHTML(hero)}" alt="Game Background Image" />` : ''}
                <div class="dialog-title">
                        ${game.images?.logo ? `<img src="${escapeHTML(game.images.logo)}" alt="Game logo" />` : `<h2>Pokémon ${escapeHTML(game.name)}</h2>`}
                </div>
            </div>
        ${game.link ? '</a>' : ''}
        <div class="dialog-main">
            <div class="dialog-rating">
                <div class="rating-number">
                    ${game.rating.score}<span>/</span><small>10</small>
                </div>
                <div class="rating-label">
                    ${game.rating.label ? escapeHTML('- ' + game.rating.label) : ''}
                </div>
            </div>
            <dl class="detail-list">
                <div>
                    <dt>Playtime</dt>
                    <dd>${formatHours(game.playtime_hours)}</dd>
                </div>
                <div>
                    <dt>Difficulty</dt>
                    <dd>${game.difficulty ? escapeHTML(game.difficulty) : 'Default'}</dd>
                </div>
                <div>
                    <dt>${game.completion?.dropped ? 'Dropped' : 'Completed'}</dt>
                    <dd>${formatDate(completion(game))}</dd>
                </div>
            </dl>
            <section class="review">
                <h3>Review</h3>
                ${reviewHTML(game.review)}
            </section>
            ${screenshots ?
                `<section class="screenshots">
                    <h3>Gallery</h3>
                    <div class="screenshot-row">${screenshots}</div>
                </section>` : ''}
        </div>`;
    const dialog = document.querySelector('#game-dialog');
    if (!dialog.open)
        dialog.showModal();
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

document.querySelector('#sort').addEventListener('change', render);
document.querySelector('#close-dialog').addEventListener('click', () => document.querySelector('#game-dialog').close());
document.querySelector('#game-dialog').addEventListener('click', event => {
    if (event.target.id === 'game-dialog')
        event.currentTarget.close();
});
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
