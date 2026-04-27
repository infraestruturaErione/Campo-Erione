export const sendSuccess = (res, data = {}, status = 200) => {
    return res.status(status).json({
        ok: true,
        ...data,
    });
};

export const sendError = (res, status, error, details) => {
    const payload = {
        ok: false,
        error,
    };

    if (details) {
        payload.details = details;
    }

    return res.status(status).json(payload);
};
