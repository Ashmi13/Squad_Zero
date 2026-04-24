import React from 'react';
import WorkOutlineIcon            from '@mui/icons-material/WorkOutline';
import SchoolOutlinedIcon         from '@mui/icons-material/SchoolOutlined';
import HomeOutlinedIcon           from '@mui/icons-material/HomeOutlined';
import FitnessCenterOutlinedIcon  from '@mui/icons-material/FitnessCenterOutlined';
import FlightOutlinedIcon         from '@mui/icons-material/FlightOutlined';
import AttachMoneyIcon            from '@mui/icons-material/AttachMoney';
import MusicNoteOutlinedIcon      from '@mui/icons-material/MusicNoteOutlined';
import LocalHospitalOutlinedIcon  from '@mui/icons-material/LocalHospitalOutlined';
import ScienceOutlinedIcon        from '@mui/icons-material/ScienceOutlined';
import EditNoteOutlinedIcon       from '@mui/icons-material/EditNoteOutlined';
import BoltOutlinedIcon           from '@mui/icons-material/BoltOutlined';
import SportsEsportsOutlinedIcon  from '@mui/icons-material/SportsEsportsOutlined';
import ShoppingCartOutlinedIcon   from '@mui/icons-material/ShoppingCartOutlined';
import RestaurantOutlinedIcon     from '@mui/icons-material/RestaurantOutlined';
import EmojiObjectsOutlinedIcon   from '@mui/icons-material/EmojiObjectsOutlined';
import BuildOutlinedIcon          from '@mui/icons-material/BuildOutlined';
import PaletteOutlinedIcon        from '@mui/icons-material/PaletteOutlined';
import TrackChangesIcon           from '@mui/icons-material/TrackChanges';
import NatureOutlinedIcon         from '@mui/icons-material/NatureOutlined';
import AssignmentOutlinedIcon     from '@mui/icons-material/AssignmentOutlined';

// Map: string key stored in DB → MUI component
export const ICON_MAP = {
  work:     WorkOutlineIcon,
  study:    SchoolOutlinedIcon,
  personal: HomeOutlinedIcon,
  fitness:  FitnessCenterOutlinedIcon,
  travel:   FlightOutlinedIcon,
  money:    AttachMoneyIcon,
  music:    MusicNoteOutlinedIcon,
  health:   LocalHospitalOutlinedIcon,
  science:  ScienceOutlinedIcon,
  notes:    EditNoteOutlinedIcon,
  bolt:     BoltOutlinedIcon,
  gaming:   SportsEsportsOutlinedIcon,
  shopping: ShoppingCartOutlinedIcon,
  food:     RestaurantOutlinedIcon,
  ideas:    EmojiObjectsOutlinedIcon,
  tools:    BuildOutlinedIcon,
  art:      PaletteOutlinedIcon,
  goals:    TrackChangesIcon,
  nature:   NatureOutlinedIcon,
  tasks:    AssignmentOutlinedIcon,
};

export function TaskIcon({ name, sx }) {
    const Component = ICON_MAP[name];
    // If it's a known key → render MUI icon
    if (Component) return <Component sx={sx} />;
    // If it's an old emoji string → render it as text (backward compat)
    return <span style={{ fontSize: sx?.fontSize || 18, lineHeight: 1 }}>{name}</span>;
  }