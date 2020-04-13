const lock = document.getElementById('lock');
const dialog = document.querySelector('dialog');
const spinnerDigitWrapperTemplate = document.getElementById('spinner-digit-wrapper').innerHTML;
const spinnerDigitHeight = 32; // px
let state;
let currentPuzzleNum;
let puzzles;

function playSound(sound){
  const audio = new Audio(`audio/${sound}.mp3`);
  audio.play();
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
  const lis = [...digit.querySelectorAll('li')];
  const [before, after] = siblingsBeforeAndAfter(centrepoint);
  const diff = Math.abs(before.length - after.length);
  if(diff < 2) return;
  if(before.length > after.length){
    for(let i = 0; i < diff; i++){
      console.log('moving top to bottom');
      digit.appendChild(digit.removeChild(lis[0]));
    }
  } else {
    for(let i = 0; i < diff; i++){
      console.log('moving bottom to top');
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
      alert(combo);
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

function generatePadlock(digits = 3){
  loadLockTemplate('padlock');
  let digitsHTML = '';
  for(let i = 0; i < digits; i++){
    digitsHTML += spinnerDigitWrapperTemplate;
  }
  lock.querySelector('.padlock-body .digits').innerHTML = digitsHTML;
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

function renderClues(){
  const clues = document.getElementById('clues');
  let cluesHTML = ''
  currentPuzzle().rules.forEach(clue=>{
    const digitsHTML = clue.pattern.split('').map(d=>`<span class="clue-digit">${d}</span>`).join('');
    cluesHTML += `<li class="clue"><span class="clue-pattern clue-${clue.class}">${digitsHTML}</span><span class="clue-description">${clue.description}</span></li>`;
  });
  clues.innerHTML = cluesHTML;
}

function startPuzzle(puzzleNum){
  currentPuzzleNum = puzzleNum;
  renderClues();
  generatePadlock(currentPuzzle().length);
  setState('play');
}

function startGame(){
  startPuzzle(0);
}

setUpDialogInteractions();
setUpDigitScrollButtons();
setState('loading');

fetch('puzzles.json').then(r=>r.json()).then(json=>{
  puzzles = json;
  setState('intro');
});

