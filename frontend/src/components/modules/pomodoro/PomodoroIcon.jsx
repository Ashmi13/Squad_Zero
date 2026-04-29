import React from 'react';
import { Timer } from 'lucide-react';

const PomodoroIcon = ({ size = 22, strokeWidth = 1.5 }) => {
  return <Timer size={size} strokeWidth={strokeWidth} />;
};

export default PomodoroIcon;
