import { Box, Typography } from '@mui/material';
import TaskTreesSVG from '/TaskTrees.svg';

export const TaskTreesLogo = () => {
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography sx={{ marginBottom: 0 }} variant='h3'>
        <img src={TaskTreesSVG} alt='Task Tree' style={{ width: '35px', height: '35px', marginRight: '10px' }} />
        TaskTrees
      </Typography>
      <Box sx={{ width: '100%', marginTop: -1, marginBottom: 4 }}>
        <Typography variant='caption' sx={{ width: '100%' }}>
          Team Edition
        </Typography>
      </Box>
    </Box>
  );
};
