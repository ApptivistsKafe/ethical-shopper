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

export const getGreenRedGradientColor = (
  hueOffsetPercentage: number,
  brightness: number
): string => {
  //value from 0 to 1
  var hue = ((1 - hueOffsetPercentage) * 120).toString(10);
  return `hsl(${hue},100%,${brightness}%)`;
};

/** Get background color for an ethical status badge */
export const getEthicalStatusBackgroundColor = (status: EthicalStatus | string): string => {
  switch (status?.split(':')?.[0]?.toLowerCase()) {
    case EthicalStatus.Excellent.toLowerCase():
      return getGreenRedGradientColor(0, 85);
    case EthicalStatus.Good.toLowerCase():
      return getGreenRedGradientColor(0.25, 85);
    case EthicalStatus.Mixed.toLowerCase():
      return getGreenRedGradientColor(0.5, 85);
    case EthicalStatus.Concerning.toLowerCase():
      return getGreenRedGradientColor(0.75, 85);
    case EthicalStatus.Poor.toLowerCase():
      return getGreenRedGradientColor(1, 85);
    default:
      return 'white';
  }
};

/** Get stroke color for an ethical status badge */
export const getEthicalStatusStrokeColor = (status: EthicalStatus | string): string => {
  switch (status?.split(':')?.[0]?.toLowerCase()) {
    case EthicalStatus.Excellent.toLowerCase():
      return getGreenRedGradientColor(0, 30);
    case EthicalStatus.Good.toLowerCase():
      return getGreenRedGradientColor(0.25, 30);
    case EthicalStatus.Mixed.toLowerCase():
      return getGreenRedGradientColor(0.5, 30);
    case EthicalStatus.Concerning.toLowerCase():
      return getGreenRedGradientColor(0.75, 30);
    case EthicalStatus.Poor.toLowerCase():
      return getGreenRedGradientColor(1, 30);
    default:
      return 'white';
  }
};
