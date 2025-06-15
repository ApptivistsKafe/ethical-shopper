/** Represents different levels of ethical standing for brands and companies */
export enum EthicalStatus {
  /** Highest ethical rating */
  Excellent = 'Excellent',
  /** Above average ethical rating */
  Good = 'Good',
  /** Mixed ethical considerations */
  Mixed = 'Mixed',
  /** Below average ethical rating */
  Concerning = 'Concerning',
  /** Lowest ethical rating */
  Poor = 'Poor',
}

// function getColor(value) {
//   //value from 0 to 1
//   var hue = ((1 - value) * 120).toString(10);
//   return ['hsl(', hue, ',100%,50%)'].join('');
// }
// var len = 5;
// for (var i = 0; i < len; i++) {
//   var value = i / len;
//   var d = document.createElement('div');
//   d.textContent = 'value=' + value;
//   d.style.backgroundColor = getColor(value);
//   document.body.appendChild(d);
// }

/** Get background color for an ethical status badge */
export const getEthicalStatusColor = (status: EthicalStatus | string): string => {
  switch (status.toLowerCase()) {
    case EthicalStatus.Excellent.toLowerCase():
      return 'lightgreen';
    case EthicalStatus.Good.toLowerCase():
      return 'palegreen';
    case EthicalStatus.Mixed.toLowerCase():
      return 'palegoldenrod';
    case EthicalStatus.Concerning.toLowerCase():
      return 'orange';
    case EthicalStatus.Poor.toLowerCase():
      return 'pink';
    default:
      return 'white';
  }
};
