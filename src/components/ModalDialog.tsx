import { useDialogStore } from '../store/dialogStore';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';

export function ModalDialog() {
  const hideDialog = useDialogStore((state) => state.hideDialog);
  const resolveDialog = useDialogStore((state) => state.resolveDialog);
  return (
    <Dialog open={useDialogStore((state) => state.isDialogVisible)} onClose={hideDialog}>
      <DialogTitle>{useDialogStore((state) => state.dialogTitle)}</DialogTitle>
      <DialogContent>
        <DialogContentText>{useDialogStore((state) => state.dialogMessage)}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            resolveDialog?.(true);
            hideDialog();
          }}
          variant='contained'
        >
          OK
        </Button>
        {useDialogStore((state) => state.isDialogTwoButtons) && (
          <Button
            onClick={() => {
              resolveDialog?.(false);
              hideDialog();
            }}
            variant='outlined'
          >
            Cencel
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
