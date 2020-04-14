const lock = document.getElementById('lock');
const dialog = document.querySelector('dialog');
const score = document.getElementById('score');
const spinnerDigitWrapperTemplate = document.getElementById('spinner-digit-wrapper').innerHTML;
const spinnerDigitHeight = 32; // px
let state;
let currentPuzzleNum;
let puzzles;
let triedPuzzles = [];
let solvedPuzzles = [];
let sounds = { fail: null, unlock: null }
let lastKeyboardDigit = 0;

function loadSounds(){
  Object.keys(sounds).forEach(s=>sounds[s] = new Audio(`audio/${s}.mp3`))
}

function playSound(sound){
  sounds[sound].play();
}

function siblingsBeforeAndAfter(el){
  let before = [], after = [];
  let foundEl = false;
  [...el.parentNode.children].forEach(sibling=>{
    if(sibling === el) {
      foundEl = true;
      return;
    }
    if(foundEl) {
      after.push(sibling);
    } else {
      before.push(sibling);
    }
  });
  return [before, after];
}

function recenterScrollingDigit(digit, centrepoint){
  // support endless-scroll where possible
  const lis = [...digit.querySelectorAll('li')];
  const [before, after] = siblingsBeforeAndAfter(centrepoint);
  const diff = Math.abs(before.length - after.length);
  if(diff < 2) return;
  if(before.length > after.length){
    for(let i = 0; i < diff; i++){
      // move top to bottom
      digit.appendChild(digit.removeChild(lis[0]));
    }
  } else {
    for(let i = 0; i < diff; i++){
      // move bottom to top
      digit.insertBefore(digit.removeChild(lis[lis.length-1]), digit.firstChild);
    }
  }
}

function snapToDigit(digit, li){
  li.scrollIntoView();
  digit.scrollBy(0, -7);
}

function digitIntersectionObserved(entries, observer){
  const digit = observer.root, visibleEntries = entries.filter(entry=>entry.intersectionRatio==1);
  if(visibleEntries == 0) return;
  const li = visibleEntries[0].target;
  digit.closest('.digit-wrapper').querySelector('input').value = parseInt(li.dataset.value);
  recenterScrollingDigit(digit, li);
  snapToDigit(digit, li);
}

function setUpDigitIntersectionObservers(){
  [...document.querySelectorAll('.spinner-digits .digit')].filter(digit=>!digit.dataset.observed).forEach(digit=>{
    digit.dataset.observed = true;
    const lis = [...digit.querySelectorAll('li')];
    snapToDigit(digit, lis[parseInt(lis.length / 2)]);
    const observer = new IntersectionObserver(digitIntersectionObserved, {
      root: digit,
      rootMargin: '0px',
      threshold: 1.0,
    });
    [...digit.querySelectorAll('li')].forEach(li=>observer.observe(li));
  });
}

function setUpDigitScrollButtons(){
  lock.addEventListener('click', e=>{
    const button = e.target.closest('button');
    if(!button) return;
    e.preventDefault();
    if(button.classList.contains('digit-up')){
      const digit = button.closest('.digit-wrapper').querySelector('.digit');
      digit.scrollBy(0, 1 - spinnerDigitHeight);
      return;
    }
    if(button.classList.contains('digit-down')){
      const digit = button.closest('.digit-wrapper').querySelector('.digit');
      digit.scrollBy(0, spinnerDigitHeight);
      return;
    }
    if(button.classList.contains('unlock')){
      let combo = [...lock.querySelectorAll('input')].map(input=>input.value).join('');
      if(combo == ''){
        // if the IntersectionObserver fails, e.g. on Chrome for Android, we might not have a value: get one the hard way
        [...lock.querySelectorAll('.digit')].forEach(digit=>{
          combo += digit.querySelectorAll('li')[Math.round(digit.scrollTop / spinnerDigitHeight)].dataset.value;
        });
      }
      attemptSolution(combo);
      return;
    }
  }, { capture: true });
}

function loadLockTemplate(lockName){
  const lockTemplate = document.querySelector(`#${lockName}`);
  lock.className = lockTemplate.className;
  lock.innerHTML = lockTemplate.innerHTML;
}

function setUpDialogInteractions(){
  dialog.addEventListener('click', e=>{
    const button = e.target.closest('button');
    if(!button) return;
    e.preventDefault();
    const action = button.dataset.action;
    if(action == 'start'){
      startGame();
    }
  }, { capture: true });
}

function anotherPuzzle(){
  if(triedPuzzles.length == 1){
    startPuzzle(1); // move on to the next one
  } else {
    const untriedPuzzles = [...Array(puzzles.length).keys()].filter(pid=>!triedPuzzles.includes(pid));
    const unsolvedPuzzles = [...Array(puzzles.length).keys()].filter(pid=>!solvedPuzzles.includes(pid));
    let targetPuzzle;
    if(untriedPuzzles.length > 0){
      targetPuzzle = untriedPuzzles[Math.floor(Math.random()*untriedPuzzles.length)];
    } else {
      targetPuzzle = unsolvedPuzzles[Math.floor(Math.random()*unsolvedPuzzles.length)];
    }
    if(targetPuzzle){
      startPuzzle(targetPuzzle);
    } else {
      alert("You've solved every puzzle! There aren't any more for you to do (for now).")
    }
  }
}

function setUpScoreInteractions(){
  score.addEventListener('click', e=>{
    const button = e.target.closest('button');
    if(!button) return;
    e.preventDefault();
    const action = button.dataset.action;
    if(action == 'another-puzzle'){
      anotherPuzzle();
    }
  }, { capture: true });
}

function generatePadlock(){
  loadLockTemplate('padlock');
  let digitsHTML = '';
  for(let i = 0; i < currentPuzzle().length; i++){
    digitsHTML += spinnerDigitWrapperTemplate;
  }
  lock.querySelector('.padlock-body .digits').innerHTML = digitsHTML;
  const digitLIs = currentPuzzle().alphabet.reverse().map(a=>`<li data-value="${a}">${a}</li>`).join('');
  [...lock.querySelectorAll('.padlock-body .digit')].forEach(digit=>digit.innerHTML = digitLIs);
  setUpDigitIntersectionObservers();
}

function renderState(){
  if(state == 'play'){
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  } else {
    dialog.innerHTML = document.getElementById(state).innerHTML;
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', true);
    }
  }
}

function setState(newState){
  state = newState;
  renderState();
}

function currentPuzzle(){
  return puzzles[currentPuzzleNum];
}

function updateScore(){
  let totalScore = 0;
  solvedPuzzles.forEach(pid=>totalScore+=puzzles[pid].difficulty);
  let scoreHTML = `<p><strong>Score: ${totalScore}</strong> (${solvedPuzzles.length} of ${puzzles.length} locks opened).</p>`;
  if(solvedPuzzles.length > 0){
    scoreHTML += `<p class="score-buttons">Get: <button data-action="another-puzzle">Another lock</button> <button data-action="specific-puzzle">A specific lock</button></p>`;
  }
  score.innerHTML = scoreHTML;
}

function renderInstructions(){
  const instruction = document.getElementById('instruction');
  let describeAlphabet = currentPuzzle().alphabet.join(', ');
  if(parseInt(currentPuzzle().alphabet[0]) < parseInt(currentPuzzle().alphabet[currentPuzzle().alphabet.length - 1])) {
    describeAlphabet = `from ${currentPuzzle().alphabet[0]}&mdash;${currentPuzzle().alphabet[currentPuzzle().alphabet.length - 1]}`;
  }
  let instructionsHTML = [];
  if(currentPuzzle().instruction) instructionsHTML.push(currentPuzzle().instruction);
  instructionsHTML.push(`The combination consists of ${currentPuzzle().length} values ${describeAlphabet}. Difficulty rating: ${currentPuzzle().difficulty}.`);
  instruction.innerHTML = `<h1>Lock ${(currentPuzzleNum + 1).toString().padStart(4, '0')}</h1><p>${instructionsHTML.join('<br>')}</p>`;
}

function renderClues(){
  const clues = document.getElementById('clues');
  let cluesHTML = ''
  currentPuzzle().rules.forEach(clue=>{
    const digitsHTML = clue.pattern ? clue.pattern.split('').map(d=>`<span class="clue-digit">${d}</span>`).join('') : '';
    cluesHTML += `<li class="clue clue-${clue.class}"><span class="clue-pattern">${digitsHTML}</span><span class="clue-description">${clue.description}</span></li>`;
  });
  clues.innerHTML = cluesHTML;
}

function attemptSolution(combo){
  if(currentPuzzle().answer.includes(combo)){
    // correct answer
    playSound('unlock');
    lock.classList.add('open');
    solvedPuzzles.push(currentPuzzleNum);
    solvedPuzzles = Array.from(new Set(solvedPuzzles)); // remove duplicates
    updateScore();
  } else {
    // wrong answer
    lock.classList.add('wrong');
    setTimeout(()=>lock.classList.remove('wrong'), 850);
    playSound('fail');
  }
}

function startPuzzle(puzzleNum){
  currentPuzzleNum = puzzleNum;
  triedPuzzles.push(puzzleNum);
  triedPuzzles = Array.from(new Set(triedPuzzles)); // remove duplicates
  renderInstructions();
  renderClues();
  lock.classList.remove('open');
  generatePadlock();
  updateScore();
  setState('play');
}

function startGame(){
  startPuzzle(0);
}

loadSounds();
setUpDialogInteractions();
setUpScoreInteractions();
setUpDigitScrollButtons();
setState('loading');

fetch('puzzles.json').then(r=>r.json()).then(json=>{
  puzzles = json;
  setState('intro');
});

