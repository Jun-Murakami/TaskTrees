import { useEffect } from 'react';
import { useDialogStore } from '@/store/dialogStore';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';

export function ModalDialog() {
  const hideDialog = useDialogStore((state) => state.hideDialog);
  const resolveDialog = useDialogStore((state) => state.resolveDialog);
  const isDialogTwoButtons = useDialogStore((state) => state.isDialogTwoButtons);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !isDialogTwoButtons) {
        event.preventDefault(); // デフォルトの挙動をキャンセル
        resolveDialog?.(true);
        hideDialog();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [hideDialog, resolveDialog, isDialogTwoButtons]);

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
