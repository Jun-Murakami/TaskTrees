import { useInputDialogStore } from '../store/dialogStore';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

export function InputDialog() {
  const hideDialog = useInputDialogStore((state) => state.hideDialog);
  const resolveDialog = useInputDialogStore((state) => state.resolveDialog);
  const defaultValue = useInputDialogStore((state) => state.defaultValue);
  const isPassword = useInputDialogStore((state) => state.isPassword);

  let inputValue: string = '';

  function setInputValue(value: string) {
    inputValue = value;
  }

  return (
    <Dialog open={useInputDialogStore((state) => state.isDialogVisible)} onClose={hideDialog}>
      <DialogTitle>{useInputDialogStore((state) => state.dialogTitle)}</DialogTitle>
      <DialogContent>
        <DialogContentText>{useInputDialogStore((state) => state.dialogMessage)}</DialogContentText>
        <TextField
          autoFocus
          margin='dense'
          id={isPassword ? 'filled-password-input' : 'filled-basic'}
          variant='outlined'
          label={useInputDialogStore((state) => state.dialogLabel)}
          type={isPassword ? 'password' : 'text'}
          defaultValue={defaultValue}
          fullWidth
          onChange={(e) => {
            setInputValue(e.target.value);
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          variant='contained'
          onClick={() => {
            resolveDialog?.(inputValue);
            hideDialog();
          }}
        >
          OK
        </Button>
        <Button
          variant='outlined'
          onClick={() => {
            resolveDialog?.('');
            hideDialog();
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
