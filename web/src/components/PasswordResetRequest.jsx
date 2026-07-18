import * as React from "react";
import { useState } from "react";
import { TextField, Button, Box, Typography } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import accountApi from "../app/AccountApi";
import AvatarBox from "./AvatarBox";
import routes from "./routes";

const PasswordResetRequest = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setSending(true);
      const result = await accountApi.requestPasswordReset(username);
      if (result?.token) {
        navigate(`/account/password/reset/${result.token}`);
        return;
      }
      setSent(true);
    } catch (e) {
      console.log(`[PasswordResetRequest] Request failed`, e);
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  if (!config.enable_reset_password) {
    return (
      <AvatarBox>
        <Typography sx={{ typography: "h6" }}>{t("reset_password_disabled")}</Typography>
        <Typography sx={{ mt: 2 }}>
          <NavLink to={routes.login} variant="body1">
            {t("reset_password_back_to_login")}
          </NavLink>
        </Typography>
      </AvatarBox>
    );
  }

  if (sent) {
    return (
      <AvatarBox>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CheckCircleOutlineIcon color="success" sx={{ fontSize: 28 }} />
          <Typography sx={{ typography: "h6" }}>{t("reset_password_sent_title")}</Typography>
        </Box>
        <Typography sx={{ mt: 1, textAlign: "center" }}>{t("reset_password_sent_description")}</Typography>
        <Typography sx={{ mt: 2, mb: 4 }}>
          <NavLink to={routes.login} variant="body1">
            {t("reset_password_back_to_login")}
          </NavLink>
        </Typography>
      </AvatarBox>
    );
  }

  return (
    <AvatarBox>
      <Typography sx={{ typography: "h6" }}>{t("reset_password_request_title")}</Typography>
      <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
        <Typography sx={{ mt: 1 }}>{t("reset_password_request_description")}</Typography>
        <TextField
          margin="dense"
          required
          fullWidth
          id="username"
          label={t("signup_form_username")}
          name="username"
          value={username}
          onChange={(ev) => setUsername(ev.target.value.trim())}
          autoFocus
        />
        <Button type="submit" fullWidth variant="contained" disabled={sending || username === ""} sx={{ mt: 2, mb: 2 }}>
          {t("reset_password_request_button_submit")}
        </Button>
      </Box>
      {config.enable_login && (
        <Typography sx={{ mb: 4 }}>
          <NavLink to={routes.login} variant="body1">
            {t("reset_password_back_to_login")}
          </NavLink>
        </Typography>
      )}
    </AvatarBox>
  );
};

export default PasswordResetRequest;
