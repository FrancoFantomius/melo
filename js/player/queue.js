let queue = [];
let originalQueue = [];
let currentIndex = -1;
let shuffle = false;
let repeat = 'none'; // 'none' | 'all' | 'one'

function getTrackId(track) {
  if (!track) return null;
  if (track.Id !== undefined && track.Id !== null) return track.Id;
  if (track.id !== undefined && track.id !== null) return track.id;
  return null;
}

function isSameTrack(t1, t2) {
  if (!t1 || !t2) return false;
  const id1 = getTrackId(t1);
  const id2 = getTrackId(t2);
  if (id1 !== null && id2 !== null) {
    return String(id1) === String(id2);
  }
  return t1 === t2;
}

export function restoreQueueState(savedState) {
  if (!savedState) return;
  if (Array.isArray(savedState.queue)) queue = savedState.queue;
  if (Array.isArray(savedState.originalQueue)) originalQueue = savedState.originalQueue;
  if (typeof savedState.currentIndex === 'number') currentIndex = savedState.currentIndex;
  if (typeof savedState.shuffle === 'boolean') shuffle = savedState.shuffle;
  if (savedState.repeat) repeat = savedState.repeat;
}

export function setQueue(tracks, startIndex = 0) {
  originalQueue = [...tracks];
  if (shuffle) {
    queue = shuffleArray([...tracks]);
    // Find selected track in shuffled queue and place it first
    const selected = tracks[startIndex];
    const newIdx = queue.findIndex(t => isSameTrack(t, selected));
    if (newIdx > -1) {
      const temp = queue[0];
      queue[0] = queue[newIdx];
      queue[newIdx] = temp;
    }
    currentIndex = 0;
  } else {
    queue = [...tracks];
    currentIndex = startIndex;
  }
}

export function getCurrentTrack() {
  if (currentIndex >= 0 && currentIndex < queue.length) {
    return queue[currentIndex];
  }
  return null;
}

export function setCurrentIndex(index) {
  if (typeof index === 'number' && index >= 0 && index < queue.length) {
    currentIndex = index;
    return queue[currentIndex];
  }
  return null;
}

export function setCurrentTrack(track) {
  if (!track) return null;
  const current = getCurrentTrack();
  if (current && isSameTrack(current, track)) {
    return current;
  }
  const idx = queue.findIndex(t => isSameTrack(t, track));
  if (idx > -1) {
    currentIndex = idx;
    return queue[currentIndex];
  }
  return null;
}

export function peekNextTrack(isAutoEnd = true) {
  if (queue.length === 0) return null;

  if (repeat === 'one') {
    return getCurrentTrack();
  }

  if (currentIndex < queue.length - 1) {
    return queue[currentIndex + 1];
  } else if (repeat === 'all') {
    return queue[0];
  }
  return null;
}

export function nextTrack(isAutoEnd = false) {
  if (queue.length === 0) return null;

  if (repeat === 'one') {
    if (isAutoEnd) {
      return getCurrentTrack();
    }
  }

  if (currentIndex < queue.length - 1) {
    currentIndex++;
    return queue[currentIndex];
  } else if (repeat === 'all') {
    currentIndex = 0;
    return queue[0];
  }
  return null;
}

export function prevTrack() {
  if (queue.length === 0) return null;
  if (currentIndex > 0) {
    currentIndex--;
    return queue[currentIndex];
  } else if (repeat === 'all') {
    currentIndex = queue.length - 1;
    return queue[currentIndex];
  }
  return getCurrentTrack();
}

export function toggleShuffle() {
  shuffle = !shuffle;
  const currentTrack = getCurrentTrack();
  if (shuffle) {
    queue = shuffleArray([...originalQueue]);
    if (currentTrack) {
      const idx = queue.findIndex(t => isSameTrack(t, currentTrack));
      if (idx > -1) {
        queue.splice(idx, 1);
        queue.unshift(currentTrack);
      }
    }
    currentIndex = 0;
  } else {
    queue = [...originalQueue];
    if (currentTrack) {
      const idx = queue.findIndex(t => isSameTrack(t, currentTrack));
      if (idx > -1) {
        currentIndex = idx;
      }
    }
  }
  return shuffle;
}

export function toggleRepeat() {
  if (repeat === 'none' || repeat === false) {
    repeat = 'all';
  } else if (repeat === 'all') {
    repeat = 'one';
  } else {
    repeat = 'none';
  }
  return repeat;
}

export function addToQueue(tracks) {
  if (!Array.isArray(tracks) || tracks.length === 0) return 0;
  originalQueue.push(...tracks);
  queue.push(...tracks);
  return tracks.length;
}

export function removeFromQueue(index) {
  if (typeof index !== 'number' || index < 0 || index >= queue.length) return false;
  const removedTrack = queue[index];
  queue.splice(index, 1);
  const origIdx = originalQueue.findIndex(t => isSameTrack(t, removedTrack));
  if (origIdx > -1) originalQueue.splice(origIdx, 1);

  if (index < currentIndex) {
    currentIndex--;
  } else if (index === currentIndex) {
    if (currentIndex >= queue.length) {
      currentIndex = queue.length - 1;
    }
  }
  return true;
}

export function clearQueue() {
  const current = getCurrentTrack();
  if (current) {
    queue = [current];
    originalQueue = [current];
    currentIndex = 0;
  } else {
    queue = [];
    originalQueue = [];
    currentIndex = -1;
  }
}

export function getQueueState() {
  return {
    queue,
    currentIndex,
    shuffle,
    repeat
  };
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
