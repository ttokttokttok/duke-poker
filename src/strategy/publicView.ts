import type { Card, GameState, PlayerId, Street } from '../poker/types';

export interface PublicGameView {
  myId: PlayerId;
  myHoleCards: [Card, Card];
  myStack: number;
  myStreetContribution: number;
  myTotalContribution: number;
  opponentStack: number;
  opponentStreetContribution: number;
  opponentTotalContribution: number;
  opponentFolded: boolean;
  opponentAllIn: boolean;
  board: Card[];
  street: Street;
  pot: number;
  currentBet: number;
  lastRaiseSize: number;
  canReopen: boolean;
  blinds: { smallBlind: number; bigBlind: number };
  button: PlayerId;
  iAmButton: boolean;
  handNumber: number;
  actionHistory: string[];
}

export function makePublicView(s: GameState, myId: PlayerId): PublicGameView {
  const me = s.players[myId];
  const opp = s.players[1 - myId];
  if (!me.holeCards) throw new Error('My hole cards missing');
  return {
    myId,
    myHoleCards: me.holeCards,
    myStack: me.stack,
    myStreetContribution: me.streetContribution,
    myTotalContribution: me.totalContribution,
    opponentStack: opp.stack,
    opponentStreetContribution: opp.streetContribution,
    opponentTotalContribution: opp.totalContribution,
    opponentFolded: opp.folded,
    opponentAllIn: opp.allIn,
    board: [...s.board],
    street: s.street,
    pot: s.pot,
    currentBet: s.currentBet,
    lastRaiseSize: s.lastRaiseSize,
    canReopen: s.canReopen,
    blinds: { ...s.blinds },
    button: s.button,
    iAmButton: s.button === myId,
    handNumber: s.handNumber,
    actionHistory: [...s.log],
  };
}
