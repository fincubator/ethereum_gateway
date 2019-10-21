use std::error::Error;

use futures::TryFutureExt;

use tokio::{
    net::{TcpListener, TcpStream},
    prelude::*,
};

mod pg {
    pub use tokio_postgres::{tls::NoTls, Config};
}

mod hyper {
    pub use hyper::{
        server::accept::from_stream,
        service::{make_service_fn, service_fn},
        Body, Error, Method, Request, Response, Result, Server, StatusCode,
    };
}

#[inline]
async fn index(
    _request: hyper::Request<hyper::Body>,
) -> hyper::Result<hyper::Response<hyper::Body>> {
    let (mut client, connection) = "user=test password=test dbname=test"
        .parse::<pg::Config>()
        .unwrap()
        .connect_raw(
            TcpStream::connect("127.0.0.1:8090").await.unwrap(),
            pg::NoTls,
        )
        .await
        .unwrap();

    tokio::spawn(connection.unwrap_or_else(|_| ()));

    let stmt = client.prepare("SELECT id FROM test").await.unwrap();

    client.execute(&stmt, &[]).await.unwrap();

    Ok(hyper::Response::new(hyper::Body::from("Hello, World")))
}

#[inline]
async fn not_found(
    _request: hyper::Request<hyper::Body>,
) -> hyper::Result<hyper::Response<hyper::Body>> {
    let mut not_found = hyper::Response::default();

    *not_found.status_mut() = hyper::StatusCode::NOT_FOUND;

    Ok(not_found)
}

#[inline]
async fn route(
    request: hyper::Request<hyper::Body>,
) -> hyper::Result<hyper::Response<hyper::Body>> {
    match (request.method(), request.uri().path()) {
        (&hyper::Method::GET, "/") => index(request).await,
        _ => not_found(request).await,
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    pretty_env_logger::try_init_timed()?;

    hyper::Server::builder(hyper::from_stream(
        TcpListener::bind("127.0.0.1:8080").await?.incoming(),
    ))
    .serve(hyper::make_service_fn(|_| {
        async { Ok::<_, hyper::Error>(hyper::service_fn(route)) }
    }))
    .await?;

    Ok(())
}
